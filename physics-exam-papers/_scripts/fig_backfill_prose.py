#!/usr/bin/env python3
"""文字引用缺图回填（试点版）：为"题干引用了图N/如图所示但整题无配图"的题，
从原卷页面图中检测插图、按编号或视觉匹配裁剪，写 assets + figures 表，
并把 {{fig:N}} 占位符写回题干（prose 题插在引用文字之后，变体占位符规范化）。

用法：
  python3 fig_backfill_prose.py --paper "江苏-2015-2015苏州" [--paper ...] [--dry]
"""
import argparse
import base64
import io
import json
import re
import sqlite3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kimi_pipeline import (ROOT, STATE, BANK, DB_PATH, MODEL,
                           load_inventory)
from fig_backfill import (ASSETS, BOX_CACHE, LABEL_RE, QNUM_RE,
                          group_pages, pick_best, detect_figures,
                          question_texts, safe_name,
                          box_confidence, _img_mime)
from kimi_pipeline import chat as _chat

from PIL import Image


def crop_of(fig, page):
    im = Image.open(page["image"])
    W, H = im.size
    pad_x, pad_y = 0.015, 0.012
    x0, y0, x1, y1 = fig["box"]
    x0, y0 = max(0.0, x0 - pad_x), max(0.0, y0 - pad_y)
    x1, y1 = min(1.0, x1 + pad_x), min(1.0, y1 + pad_y)
    return im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))

# 引用"图N"的正文（排除 图像/图象/图形/作图/图例 等）
FIGNUM_RE = re.compile(r'(?<![像形例分])图\s*(\d{1,2})(?![0-9a-zA-Z])')
# 无编号的引图词
GENERIC_RE = re.compile(r'如图所示|如下图|如下图所示|如右图|如左图|如图所视')
# 变体占位 {{fig:2：描述}} / {{fig:2:desc}}
VARIANT_RE = re.compile(r'\{\{fig:(\d+)[：:][^}]*\}\}')
# 规范占位
CANON_RE = re.compile(r'\{\{fig:(\d+)\}\}')


def vision_pick(question_text, cand_bytes_list):
    """视觉选图（低推理模式加速）：返回最佳下标；-1 表示都不匹配。"""
    if not cand_bytes_list:
        return -1
    content = [{"type": "text", "text": "题目：" + (question_text or "")[:600]}]
    for i, b in enumerate(cand_bytes_list):
        b64 = base64.b64encode(b).decode()
        content.append({"type": "text", "text": f"候选图{i}:"})
        content.append({"type": "image_url",
                        "image_url": {"url": f"data:{_img_mime(b)};base64,{b64}"}})
    content.append({"type": "text", "text":
                    "以上是一道初中物理题和若干候选插图。选出与题目内容最匹配的一张。"
                    "只输出一个整数：最匹配候选图的序号；如果都不匹配，输出 -1。不要输出任何其他内容。"})
    try:
        r, _usage = _chat([{"role": "user", "content": content}],
                          max_tokens=1024, json_mode=False, retries=2, effort="low")
        r = (r or "").strip()
        m = re.search(r"-?\d+", r)
        if not m:
            return -1
        k = int(m.group(0))
        return k if -1 <= k < len(cand_bytes_list) else -1
    except Exception as e:
        print(f"  [warn] 视觉选图失败: {e}", file=sys.stderr)
        return -1


def whiten(im):
    """纸底提亮：边框估计纸色，近白纸底拉白；深色/照片底不动。"""
    import numpy as np
    a = None
    try:
        a = np.asarray(im.convert('RGB')).astype(np.float32)
        border = np.concatenate([
            a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
            a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
        bg = np.median(border, axis=0)
        if bg.min() < 150:  # 深色底/照片，不动
            return im
        gain = 255.0 / np.maximum(bg, 1.0)
        out = np.clip(a * gain[None, None, :], 0, 255).astype('uint8')
        return type(im).fromarray(out)
    except Exception:
        return im


def ref_keys_and_sites(text):
    """返回 [(num_str, 出现位置end), ...] 去重；num_str 为 '' 表示无编号引图。"""
    sites = []
    seen = set()
    for m in VARIANT_RE.finditer(text):
        if m.group(1) not in seen:
            seen.add(m.group(1))
            sites.append((m.group(1), m.end(), m.span()))
    for m in CANON_RE.finditer(text):
        if m.group(1) not in seen:
            seen.add(m.group(1))
            sites.append((m.group(1), m.end(), m.span()))
    for m in FIGNUM_RE.finditer(text):
        n = m.group(1)
        if n not in seen:
            seen.add(n)
            sites.append((n, m.end(), m.span()))
    if not sites and GENERIC_RE.search(text):
        sites.append(('', GENERIC_RE.search(text).end(),
                      GENERIC_RE.search(text).span()))
    return sites


def insert_placeholder(text, sites, key_map):
    """按出现位置从后往前插入 {{fig:k}}，避免位移。key_map: num_str -> key。"""
    inserts = []
    for num, _end, span in sites:
        k = key_map.get(num)
        if k:
            inserts.append((span[1], k))
    for pos, k in sorted(inserts, reverse=True):
        text = text[:pos] + "{{fig:%s}}" % k + text[pos:]
    return text


def process_paper(db, paper, groups_by_id, dry=False, max_vision_batches=4):
    pid = paper["paperId"]
    # 目标：整题无配图记录的题
    rows = db.execute(
        "SELECT qid, number, type, stem, options, subQuestions FROM questions "
        "WHERE paperId=? AND qid NOT IN (SELECT DISTINCT qid FROM figures)",
        (pid,)).fetchall()
    targets = []
    for q in rows:
        stem = q["stem"] or ""
        subs = q["subQuestions"] or ""
        opts = q["options"] or ""
        if "图" not in stem + subs + opts:
            continue
        # 题干+子题的引用点
        stem_sites = ref_keys_and_sites(stem)
        sub_sites = ref_keys_and_sites(subs)
        if not stem_sites and not sub_sites:
            continue
        targets.append((q, stem_sites, sub_sites))
    if not targets:
        print(f"[{pid}] 无目标题", file=sys.stderr)
        return 0, 0, 0

    gid = pick_best(paper["questionGroups"], groups_by_id)
    if not gid:
        print(f"[{pid}] 无来源组", file=sys.stderr)
        return 0, 0, 0
    channel, pages = group_pages(gid)
    if not pages:
        print(f"[{pid}] 通道 {channel} 无页面图", file=sys.stderr)
        return 0, 0, 0

    # 全卷插图预检（带缓存）
    page_figs = {}
    global_by_label, global_by_qnum = {}, {}
    for page in pages:
        try:
            figs = detect_figures(page["image"], set())
        except Exception as e:
            print(f"[{pid}] 页 {page['key']} 检测失败: {e}", file=sys.stderr)
            figs = []
        page_figs[page["key"]] = figs
        for f in figs:
            lab = f.get("label", "") or ""
            nums = LABEL_RE.findall(lab)
            if nums and nums[0] not in global_by_label:
                global_by_label[nums[0]] = (f, page)
            qm = QNUM_RE.search(lab)
            if qm and qm.group(1) not in global_by_qnum:
                global_by_qnum[qm.group(1)] = (f, page)

    used = set()
    saved = failed = 0
    for q, stem_sites, sub_sites in targets:
        # 需要的图：去重后的引用编号
        nums = []
        for n, _e, _s in stem_sites + sub_sites:
            if n not in nums:
                nums.append(n)
        # key 编排：变体/规范占位沿用原数字，prose 编号按 1..n 分配
        key_map = {}
        next_key = 1
        for n in nums:
            if n and n not in key_map:
                key_map[n] = n
        for n in nums:
            if n == '':
                while str(next_key) in key_map.values():
                    next_key += 1
                key_map[n] = str(next_key)
        # prose 编号题 key 直接用编号数字；若与已有占位冲突已由上面保证唯一
        got = {}  # num -> (fig, page)
        qtext = " ".join(question_texts({"stem": q["stem"], "subQuestions": q["subQuestions"]}))[:600]
        for n in nums:
            fig = page = None
            if n and n in global_by_label and id(global_by_label[n][0]) not in used:
                fig, page = global_by_label[n]
            if fig is None and q["number"].isdigit() and q["number"] in global_by_qnum \
                    and id(global_by_qnum[q["number"]][0]) not in used:
                fig, page = global_by_qnum[q["number"]]
            if fig is None:
                pool = [(f, pg) for pg in pages
                        for f in page_figs.get(pg["key"], [])
                        if id(f) not in used]
                batches = 0
                for start in range(0, len(pool), 8):
                    if batches >= max_vision_batches:
                        break
                    batches += 1
                    batch = pool[start:start + 8]
                    crops = []
                    for f, pg in batch:
                        buf = io.BytesIO()
                        crop_of(f, pg).save(buf, format="PNG")
                        crops.append(buf.getvalue())
                    k = vision_pick(qtext, crops)
                    if k >= 0:
                        fig, page = batch[k]
                        break
            if fig is None:
                failed += 1
                print(f"[{pid}#{q['number']}] 图{n or '?'} 无匹配", file=sys.stderr)
                continue
            used.add(id(fig))
            got[n] = (fig, page)

        if not got:
            continue

        # 写图
        if not dry:
            for n, (fig, page) in got.items():
                k = key_map[n]
                crop = whiten(crop_of(fig, page))
                fname = f"{safe_name(q['qid'])}_fig{k}.png"
                crop.save(ASSETS / fname)
                conf = box_confidence(fig["box"])
                if (fig["box"][2] - fig["box"][0]) < 0.08:
                    conf = min(conf, 0.5)
                db.execute(
                    "INSERT OR REPLACE INTO figures(qid,figKey,label,page,imagePath,note,cropConfidence)"
                    " VALUES(?,?,?,?,?,?,?)",
                    (q["qid"], k, fig.get("label"), page["key"],
                     f"assets/{fname}", fig.get("desc", ""), conf))
            # 占位符写回
            stem = q["stem"] or ""
            new_stem = insert_placeholder(stem, stem_sites, key_map)
            # 变体占位规范化：{{fig:2：desc}} -> {{fig:2}}（desc）
            def norm_variant(m):
                inner = m.group(0)
                km = re.match(r"\{\{fig:(\d+)[：:]([^}]*)\}\}", inner)
                if km and km.group(1) in {key_map[n] for n in got}:
                    desc = km.group(2).strip()
                    return "{{fig:%s}}%s" % (km.group(1),
                                             ("（%s）" % desc) if desc else "")
                return inner
            new_stem = VARIANT_RE.sub(norm_variant, new_stem)
            db.execute("UPDATE questions SET stem=? WHERE qid=?", (new_stem, q["qid"]))
            if sub_sites:
                subs = q["subQuestions"] or ""
                # 子题文本按 stem 字段逐一插占位（保守：只在能定位时插）
                try:
                    arr = json.loads(subs)
                    changed = False
                    for s in arr:
                        s_sites = ref_keys_and_sites(s.get("stem", ""))
                        if s_sites:
                            s["stem"] = insert_placeholder(s.get("stem", ""), s_sites, key_map)
                            s["stem"] = VARIANT_RE.sub(norm_variant, s["stem"])
                            changed = True
                    if changed:
                        db.execute("UPDATE questions SET subQuestions=? WHERE qid=?",
                                   (json.dumps(arr, ensure_ascii=False), q["qid"]))
                except Exception as e:
                    print(f"[{pid}#{q['number']}] 子题占位写回失败: {e}", file=sys.stderr)
            db.commit()  # 逐题提交，超时重跑可断点续
            print(f"[{pid}#{q['number']}] 补图 {len(got)} 张", file=sys.stderr)
        saved += len(got)

    if not dry:
        db.commit()
    print(f"[{pid}] 目标题 {len(targets)}, 补图 {saved}, 未匹配 {failed}",
          file=sys.stderr)
    return len(targets), saved, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", action="append", required=True)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()

    inv, groups_by_id, papers_by_id = load_inventory()
    lock = __import__("threading").Lock()

    def run_one(pid):
        paper = papers_by_id.get(pid)
        if not paper:
            print(f"!! 未知试卷 {pid}", file=sys.stderr)
            return (0, 0, 0)
        db = sqlite3.connect(DB_PATH, timeout=60)
        db.row_factory = sqlite3.Row
        try:
            return process_paper(db, paper, groups_by_id, dry=args.dry)
        finally:
            db.close()

    from concurrent.futures import ThreadPoolExecutor
    tot_t = tot_s = tot_f = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        for t, s, f in ex.map(run_one, args.paper):
            tot_t += t; tot_s += s; tot_f += f
    print(json.dumps({"papers": len(args.paper), "target": tot_t,
                      "filled": tot_s, "failed": tot_f, "model": MODEL},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
