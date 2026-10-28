#!/usr/bin/env python3
"""配图错配检测与修正：用 Kimi 视觉核对 figures 表中每张配图与题目描述是否一致。

子命令：
  detect   逐张核对（缓存断点续跑），结果写入 figures.matchStatus（ok/suspect）
  fix      对 suspect 且来源为 docx/doc 内嵌图的记录，从原卷全部图片中重新挑最优候选替换
  report   输出错配清单

用法：
  python3 fig_verify.py detect [--workers 3] [--limit N]
  python3 fig_verify.py fix
  python3 fig_verify.py report
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from figure_slots import slots, valid_keys, text_fields

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kimi_pipeline import (ROOT, STATE, BANK, DB_PATH, BASE_URL, API_KEY, MODEL,
                           load_inventory)

ASSETS = BANK / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)
VERIFY_CACHE = STATE / "figverify"
FIX_CACHE = STATE / "figfix"

VERIFY_PROMPT = """这是一张从中考物理试卷中提取/裁剪的插图。它应当对应的题目内容如下：

【题目】{stem}
【配图说明】{note}

请判断这张图片是否与题目内容匹配（图片展示的就是本题所涉及的图）。
只输出 JSON：{{"match": true/false, "reason": "一句话理由"}}
- 必须逐项核对数值、单位、甲乙标记、电路连接、坐标轴、曲线和裁剪边界。只有场景相似不能判为匹配。
- 缺少必要标记、切掉线段/元件、无法确认细节时 → false
- 所需细节一致且完整 → true
- 图片明显属于其他题目、截错区域、是纯文字/页眉页脚/水印/无关内容 → false"""

FIX_PROMPT = """这道题需要一张插图：

【题目】{stem}
【配图说明】{note}

下面给你 {n} 张候选图片（来自同一份试卷文档）。请判断哪一张最匹配该题目的插图。
只输出 JSON：{{"best": 候选序号(1-{n}) 或 0, "confidence": 0-1, "reason": "一句话"}}
- 没有明显匹配的候选时 best=0"""


def get_db():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.row_factory = sqlite3.Row
    cols = {r[1] for r in db.execute("PRAGMA table_info(figures)")}
    if "matchStatus" not in cols:
        db.execute("ALTER TABLE figures ADD COLUMN matchStatus TEXT")
        db.commit()
    return db


def vision_call(parts, max_tokens=1024, tries=2):
    """parts: [{'type':'text',...}, {'type':'image_url',...}, ...]

    关闭深度思考并强制 JSON，避免推理耗尽短输出预算。
    失败最多重试一次，输出预算翻倍。
    """
    for attempt in range(tries):
        mt = max_tokens * (2 ** attempt)
        payload = {"model": MODEL, "max_tokens": mt,
                   "messages": [{"role": "user", "content": parts}],
                   "thinking": {"type": "disabled"},
                   "response_format": {"type": "json_object"}}  # 短JSON判定无需长推理
        try:
            r = requests.post(f"{BASE_URL}/chat/completions",
                              headers={"Authorization": f"Bearer {API_KEY}"},
                              json=payload, timeout=120)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(10 * (attempt + 1))
                continue
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"] or ""
            m = re.search(r"\{.*\}", content, re.DOTALL)
            if not m:
                raise ValueError(f"响应无JSON (max_tokens={mt}): {content[:150]!r}")
            return json.loads(m.group(0))
        except Exception as e:
            if attempt == tries - 1:
                print(f"  [fail] {e}", file=sys.stderr)
                return None
            time.sleep(8)
    return None


def img_part(path, max_dim=1024):
    """图片转 data-URL；过大的图先等比压缩，避免超大 base64 拖慢请求。"""
    import io
    from PIL import Image
    p = Path(path)
    data = p.read_bytes()
    try:
        with Image.open(io.BytesIO(data)) as im:
            if max(im.size) > max_dim:
                im.thumbnail((max_dim, max_dim))
                buf = io.BytesIO()
                im.convert("RGB").save(buf, "JPEG", quality=82)
                data = buf.getvalue()
    except Exception:
        pass
    b64 = base64.b64encode(data).decode()
    return {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}


FIG_DESC_RE = re.compile(r"\{\{fig:(\d+)\}\}\s*[（(]?([^）)\n]{0,60})")


def fig_description(stem, fig_key):
    """从题干中提取该 fig 占位符后面的描述文字。"""
    for m in FIG_DESC_RE.finditer(stem or ""):
        if m.group(1) == str(fig_key):
            return m.group(2).strip()
    return ""


def collect_subq_stems(q):
    return "\n".join(text_fields(dict(q)))


def verify_one(row, stem_text):
    """核对一条 figure 记录，返回 (status, reason)。带缓存。"""
    img = BANK / row["imagePath"]
    if not img.exists():
        return "suspect", "图片文件不存在"
    key = hashlib.sha256(img.read_bytes() + (MODEL + "verify-nonthinking-v1" + VERIFY_PROMPT + stem_text + str(row["figKey"]) + (row["note"] or "")).encode()).hexdigest()[:24]
    VERIFY_CACHE.mkdir(parents=True, exist_ok=True)
    cf = VERIFY_CACHE / f"{key}.json"
    if cf.exists():
        d = json.loads(cf.read_text(encoding="utf-8"))
        return d["status"], d["reason"]
    desc = fig_description(stem_text, row["figKey"])
    note = row["note"] or ""
    if desc:
        note = f"{desc}；{note}" if note else desc
    stem_brief = re.sub(r"\{\{(fig|blank):\d+\}\}", "", stem_text)[:4000]
    res = vision_call([
        {"type": "text", "text": VERIFY_PROMPT.format(stem=stem_brief, note=note or "（无）")},
        img_part(img)])
    if res is None:
        return "unchecked", "调用失败"
    if not isinstance(res.get("match"), bool) or not isinstance(res.get("reason"), str):
        return "unchecked", "复核响应字段格式错误"
    status = "ok" if res["match"] else "suspect"
    reason = res.get("reason", "")
    cf.write_text(json.dumps({"status": status, "reason": reason}, ensure_ascii=False),
                  encoding="utf-8")
    return status, reason


def cmd_detect(workers, limit, recheck=False, paper_id=None):
    db = get_db()
    rows = db.execute("""
        SELECT f.id, f.qid, f.figKey, f.imagePath, f.note, f.page, q.stem, q.options, q.subQuestions, q.answerText
        FROM figures f JOIN questions q ON q.qid = f.qid
        WHERE (? OR f.matchStatus IS NULL OR f.matchStatus = 'unchecked')
        AND (? IS NULL OR q.paperId=?)
        ORDER BY f.qid""", (int(recheck), paper_id, paper_id)).fetchall()
    if limit:
        rows = rows[:limit]
    print(f"待核对 {len(rows)} 张配图")
    done = {"ok": 0, "suspect": 0}

    local = threading.local()

    def work(row):
        stem_text = collect_subq_stems(row)
        status, reason = verify_one(row, stem_text)
        if status not in ("ok", "suspect"):
            status = "unchecked"
        if not hasattr(local, "db"):
            local.db = sqlite3.connect(DB_PATH, timeout=60)
        local.db.execute("UPDATE figures SET matchStatus=? WHERE id=?", (status, row["id"]))
        local.db.commit()
        return status, reason, row

    with ThreadPoolExecutor(max_workers=workers) as ex:
        for status, reason, row in ex.map(work, rows):
            done[status] = done.get(status, 0) + 1
            if status == "suspect":
                print(f"  ✗ {row['qid']} fig{row['figKey']}: {reason}")
    print(f"完成：匹配 {done.get('ok',0)} / 错配 {done.get('suspect',0)}")


def doc_media_candidates(paper, min_w=150, min_h=100):
    """从原卷 doc/docx 中提取全部内嵌图片，返回 [(路径, 名称)]。只保留够大的真插图。"""
    import zipfile
    import io
    from PIL import Image
    _, groups, _ = load_inventory()
    gids = []
    if paper.get("questionGroup"):
        gids.append(paper["questionGroup"])
    try:
        gids += json.loads(paper.get("answerGroups") or "[]")
    except (json.JSONDecodeError, TypeError):
        pass
    out = []
    tmp = FIX_CACHE / hashlib.md5(paper["paperId"].encode()).hexdigest()[:12]
    tmp.mkdir(parents=True, exist_ok=True)
    for gid in gids:
        src = ROOT / gid
        if not src.is_dir():
            continue
        for p in src.rglob("*.docx"):
            if p.name.startswith("~$"):
                continue
            try:
                z = zipfile.ZipFile(str(p))
                for name in z.namelist():
                    if name.startswith("word/media/") and \
                       Path(name).suffix.lower() in (".png", ".jpg", ".jpeg"):
                        dest = tmp / f"{p.stem}_{Path(name).name}"
                        if not dest.exists():
                            dest.write_bytes(z.read(name))
                        if dest.stat().st_size <= 3000:
                            continue
                        try:
                            with Image.open(dest) as im:
                                w, h = im.size
                            if w < min_w or h < min_h:
                                continue  # 公式/装饰小图
                        except Exception:
                            continue
                        out.append((dest, name))
            except Exception:
                pass
    return out


def doc_carve_candidates(paper):
    """文本型 .doc 卷：OLE 抠图 + 水印过滤，返回候选图路径列表。"""
    from fig_backfill import load_watermarks
    from kimi_pipeline import carve_doc_images
    from PIL import Image
    from collections import Counter as _Counter
    gid = paper.get("questionGroup")
    if not gid:
        return []
    src = ROOT / gid
    if not src.is_dir():
        return []
    docs = [p for p in src.rglob("*.doc") if not p.name.startswith("~$")]
    if not docs:
        return []
    tmp = FIX_CACHE / hashlib.md5(paper["paperId"].encode()).hexdigest()[:12] / "carve"
    imgs = carve_doc_images(docs[0], tmp, min_bytes=6000, min_dim=60)
    freq = _Counter(hashlib.md5(p.read_bytes()).hexdigest() for p in imgs)
    watermarks = load_watermarks()
    seen, real = set(), []
    for p in imgs:
        h = hashlib.md5(p.read_bytes()).hexdigest()
        if h in seen or freq[h] >= 3 or h in watermarks:
            continue
        seen.add(h)
        try:
            with Image.open(p) as im:
                w, hh = im.size
            if hh >= 600 and hh / max(w, 1) > 1.1:
                continue
            real.append(p)
        except Exception:
            continue
    return real


def page_box_candidates(db, paper, page_key, exclude_path):
    """视觉裁剪通道：同页其他检测框的裁剪图作为候选。"""
    from fig_backfill import group_pages, detect_figures
    from PIL import Image
    gid = paper.get("questionGroup")
    if not gid:
        return []
    try:
        _, pages = group_pages(gid)
    except Exception:
        return []
    page = None
    for pg in pages:
        if pg["key"] == page_key or pg["key"].endswith(page_key) or page_key.endswith(pg["key"]):
            page = pg
            break
    if page is None or not Path(page["image"]).exists():
        return []
    try:
        boxes = detect_figures(page["image"], set())
    except Exception:
        return []
    tmp = FIX_CACHE / hashlib.md5((paper["paperId"] + page_key).encode()).hexdigest()[:12]
    tmp.mkdir(parents=True, exist_ok=True)
    out = []
    with Image.open(page["image"]) as im:
        W, H = im.size
        for i, fb in enumerate(boxes):
            box = fb.get("box")
            if not box or len(box) != 4:
                continue
            x0, y0, x1, y1 = [max(0.0, min(1.0, float(v))) for v in box]
            if x1 - x0 < 0.03 or y1 - y0 < 0.03:
                continue
            dest = tmp / f"cand{i:02d}.png"
            if not dest.exists():
                im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H))).save(dest)
            out.append(dest)
    return out[:12]


def cmd_fix(workers=3):
    """对错配配图按来源通道重新挑选候选图替换（并行视觉调用）。"""
    db = get_db()
    rows = db.execute("""
        SELECT f.id, f.qid, f.figKey, f.imagePath, f.note, f.page, q.stem, q.subQuestions,
               q.answerText, q.paperId
        FROM figures f JOIN questions q ON q.qid = f.qid
        WHERE f.matchStatus = 'suspect'
        ORDER BY f.qid""").fetchall()
    print(f"待修复错配: {len(rows)} 条")
    papers = {r["paperId"]: dict(r) for r in db.execute("SELECT * FROM papers")}
    cand_cache = {}

    def candidates_for(row):
        paper = papers.get(row["paperId"])
        if not paper:
            return None, None
        pid = paper["paperId"]
        page = row["page"] or ""
        ck = (pid, page.split(":")[0])
        if ck not in cand_cache:
            if page.startswith("docx:"):
                cand_cache[ck] = [p for p, _ in doc_media_candidates(paper)]
            elif page.startswith("doc:"):
                cand_cache[ck] = doc_carve_candidates(paper)
            else:
                cand_cache[ck] = page_box_candidates(db, paper, page, row["imagePath"])
        return paper, cand_cache[ck]

    def work(row):
        """只做视觉调用（线程内），返回 (row, cands, res) 或 (row, None, None)。"""
        paper, cands = candidates_for(row)
        if not cands or len(cands) > 12:
            return row, None, None
        stem_text = collect_subq_stems(row)
        desc = fig_description(stem_text, row["figKey"])
        note = desc or row["note"] or ""
        stem_brief = re.sub(r"\{\{(fig|blank):\d+\}\}", "", stem_text)[:4000]
        parts = [{"type": "text", "text": FIX_PROMPT.format(
            stem=stem_brief, note=note, n=len(cands))}]
        for cpath in cands:
            parts.append(img_part(cpath))
        return row, cands, vision_call(parts, max_tokens=1024)

    fixed = skipped = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for row, cands, res in ex.map(work, rows):
            if cands is None or not res:
                skipped += 1
                continue
            best = res.get("best", 0)
            conf = res.get("confidence", 0)
            if isinstance(best, int) and 1 <= best <= len(cands) and conf >= 0.6:
                src = cands[best - 1]
                qid = row["qid"]
                safe = re.sub(r"[#\s]", "_", qid)
                ext = Path(src).suffix.lower()
                dest = ASSETS / f"{safe}_fig{row['figKey']}{ext}"
                dest.write_bytes(Path(src).read_bytes())
                db.execute("""UPDATE figures SET imagePath=?, cropConfidence=?,
                              matchStatus=NULL, note=? WHERE id=?""",
                           (f"assets/{dest.name}", min(float(conf), 0.85),
                            f"重新配对：{res.get('reason','')}", row["id"]))
                db.commit()
                fixed += 1
                print(f"  ✓ {qid} fig{row['figKey']} 重新配对（conf={conf}）{res.get('reason','')}",
                      flush=True)
            else:
                skipped += 1
    print(f"修复完成：{fixed} 条已重新配对待复核，{skipped} 条无合适候选保留警示")


FIG_RE = re.compile(r"\{\{fig:(\d+)\}\}")


# ---------------------------------------------------------------- Word→PDF 页面源

DOCPDF_DIR = STATE / "docpdf"
DOCPDF_TEXT = STATE / "docpdf_text"


def paper_word_files(paper):
    """试卷题目组里的所有 doc/docx 文件。"""
    gid = paper.get("questionGroup")
    if not gid:
        return []
    src = ROOT / gid
    if not src.is_dir():
        return []
    out = []
    for ext in ("*.doc", "*.docx"):
        out += [p for p in src.rglob(ext) if not p.name.startswith("~$")]
    return sorted(out)


def word_pdf_pages(paper):
    """把试卷的 Word 文件转 PDF 并渲染为 [{key, image, text}]，全部带缓存。"""
    from doc2pdf import convert
    from kimi_pipeline import pdf_to_images
    import pdfplumber
    docs = paper_word_files(paper)
    if not docs:
        return []
    pages = []
    for doc in docs:
        pdf, ok = convert(doc, DOCPDF_DIR)
        if not ok:
            print(f"  [warn] Word转PDF失败: {doc.name}", file=sys.stderr)
            continue
        doc_hash = hashlib.md5(str(pdf).encode()).hexdigest()[:10]
        img_dir = DOCPDF_DIR / "pages" / doc_hash
        imgs = sorted(img_dir.glob("page*.png"))
        if not imgs:
            imgs = pdf_to_images(pdf, img_dir)
        DOCPDF_TEXT.mkdir(parents=True, exist_ok=True)
        tcache = DOCPDF_TEXT / f"{doc_hash}.json"
        if tcache.exists():
            texts = json.loads(tcache.read_text(encoding="utf-8"))
        else:
            with pdfplumber.open(str(pdf)) as d:
                texts = [(pg.extract_text() or "") for pg in d.pages]
            tcache.write_text(json.dumps(texts, ensure_ascii=False), encoding="utf-8")
        for im, t in zip(imgs, texts):
            pages.append({"key": f"{doc_hash}/{im.stem}", "image": im, "text": t})
    return pages


def get_paper_pages(paper):
    """统一页面源：Word 卷走 PDF 渲染页；其余走 group_pages。"""
    if paper_word_files(paper):
        return word_pdf_pages(paper)
    from fig_backfill import group_pages
    try:
        _, pages = group_pages(paper["questionGroup"])
        return pages
    except Exception:
        return []


def pick_best_candidate(cands, stem_brief, note):
    """两轮视觉选图：候选>8 时先分组选拔再决赛。返回 (候选路径, conf, reason) 或 None。"""
    def ask(group, offset=0):
        parts = [{"type": "text", "text": FIX_PROMPT.format(
            stem=stem_brief, note=note, n=len(group))}]
        for cpath in group:
            parts.append(img_part(cpath))
        res = vision_call(parts, max_tokens=1024)
        if not res:
            return None
        best = res.get("best", 0)
        conf = res.get("confidence", 0)
        if isinstance(best, int) and 1 <= best <= len(group):
            return group[best - 1], float(conf or 0), res.get("reason", "")
        return None

    if not cands:
        return None
    if len(cands) <= 8:
        r = ask(cands)
        return r if r and r[1] >= 0.6 else None
    # 分组选拔
    winners = []
    for i in range(0, len(cands), 8):
        r = ask(cands[i:i + 8], i)
        if r:
            winners.append(r)
    if not winners:
        return None
    if len(winners) == 1:
        return winners[0] if winners[0][1] >= 0.6 else None
    final = ask([w[0] for w in winners])
    if final and final[1] >= 0.6:
        return final
    return None


def cmd_fill(workers=3, limit=0, paper_id=None):
    """为缺图槽位补图：A级=文档内嵌图视觉选图；B级=按图编号找页+视觉裁剪选图。"""
    db = get_db()
    rows = db.execute("SELECT qid,paperId,stem,options,subQuestions,answerText FROM questions").fetchall()
    pending_slots = []
    for row in rows:
        q = dict(row)
        for key in sorted(slots(q) - valid_keys(db, q["qid"], BANK), key=int):
            pending_slots.append({"qid": q["qid"], "paperId": q["paperId"],
                                  "figKey": key, "stem_text": collect_subq_stems(q)})
    excluded = set(filter(None, os.environ.get("FIGURE_EXCLUDE_PAPERS", "").split(",")))
    slots_to_fill = [s for s in pending_slots
                     if s["paperId"] not in excluded and (not paper_id or s["paperId"] == paper_id)]
    if limit:
        slots_to_fill = slots_to_fill[:limit]
    print(f"缺图槽位: {len(slots_to_fill)}")
    papers = {r["paperId"]: dict(r) for r in db.execute("SELECT * FROM papers")}
    cand_cache = {}   # pid -> [paths]（文档图源）
    page_cache = {}   # pid -> group_pages 结果

    def doc_candidates(pid):
        if pid not in cand_cache:
            paper = papers.get(pid)
            cands = []
            if paper:
                cands += [p for p, _ in doc_media_candidates(paper)]
                cands += doc_carve_candidates(paper)
            cand_cache[pid] = cands
        return cand_cache[pid]

    def page_candidates(slot):
        """B级：在试卷页面文本中找图编号所在页，检测图框作候选。"""
        from fig_backfill import detect_figures
        from PIL import Image
        pid = slot["paperId"]
        paper = papers.get(pid)
        if not paper or not paper.get("questionGroup"):
            return []
        if pid not in page_cache:
            page_cache[pid] = get_paper_pages(paper)
        pages = page_cache[pid]
        # 从题干描述中提取图编号（图15 / 图甲 等）
        desc = fig_description(slot["stem_text"], slot["figKey"])
        stem = slot["stem_text"]
        labels = re.findall(r"图\s*(\d+[甲乙丙丁]?|[甲乙丙丁])", desc + " " + stem[:200])
        target_pages = []
        for lb in labels:
            for pg in pages:
                if re.search(rf"图\s*{re.escape(lb)}(?![\d甲乙丙丁])", pg["text"] or ""):
                    target_pages.append(pg)
        if not target_pages:
            target_pages = pages  # 找不到就全页扫（较慢，但只有一次）
        tmp = FIX_CACHE / hashlib.md5(
            (pid + slot["qid"] + slot["figKey"]).encode()).hexdigest()[:12]
        tmp.mkdir(parents=True, exist_ok=True)
        out = []
        seen_pages = set()
        for pg in target_pages:
            ip = str(pg["image"])
            if ip in seen_pages or not Path(ip).exists():
                continue
            seen_pages.add(ip)
            try:
                boxes = detect_figures(ip, set(labels))
            except Exception:
                continue
            with Image.open(ip) as im:
                W, H = im.size
                for i, fb in enumerate(boxes):
                    box = fb.get("box")
                    if not box or len(box) != 4:
                        continue
                    x0, y0, x1, y1 = [max(0.0, min(1.0, float(v))) for v in box]
                    if x1 - x0 < 0.03 or y1 - y0 < 0.03:
                        continue
                    dest = tmp / f"p{len(seen_pages)}_{i:02d}.png"
                    im.crop((int(x0 * W), int(y0 * H),
                             int(x1 * W), int(y1 * H))).save(dest)
                    out.append(dest)
        return out

    # 预转换所有 Word 卷（AppleScript 必须串行，不能进线程池）
    for pid in dict.fromkeys(s["paperId"] for s in slots_to_fill):
        paper = papers.get(pid)
        if paper and paper_word_files(paper) and pid not in page_cache:
            print(f"  预处理 Word→PDF: {pid}", flush=True)
            page_cache[pid] = get_paper_pages(paper)
    # 文档候选图也串行预提取（避免多线程并发抠图/解压互相踩踏）
    for pid in dict.fromkeys(s["paperId"] for s in slots_to_fill):
        doc_candidates(pid)

    def work(slot):
        try:
            return _work(slot)
        except Exception as e:
            print(f"  [warn] {slot['qid']} fig{slot['figKey']}: {e}",
                  file=sys.stderr, flush=True)
            return slot, None, None

    def _work(slot):
        stem_text = slot["stem_text"]
        desc = fig_description(stem_text, slot["figKey"])
        stem_brief = re.sub(r"\{\{(fig|blank):\d+\}\}", "", stem_text)[:4000]
        # 先文档内嵌图选图；选不出再走 PDF/页面图裁剪
        cands = doc_candidates(slot["paperId"])
        source = "doc"
        r = pick_best_candidate(cands, stem_brief, desc or "本题插图") if cands else None
        if not r:
            cands = page_candidates(slot)
            source = "page"
            r = pick_best_candidate(cands, stem_brief, desc or "本题插图") if cands else None
        if not r:
            return slot, None, None
        return slot, r, source

    filled = failed = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for slot, r, source in ex.map(work, slots_to_fill):
            if not r:
                failed += 1
                continue
            src, conf, reason = r
            qid = slot["qid"]
            safe = re.sub(r"[#\s]", "_", qid)
            ext = Path(src).suffix.lower()
            dest = ASSETS / f"{safe}_fig{slot['figKey']}{ext}"
            dest.write_bytes(Path(src).read_bytes())
            db.execute(
                "INSERT OR REPLACE INTO figures(qid,figKey,label,page,imagePath,"
                "note,cropConfidence,matchStatus) VALUES(?,?,?,?,?,?,?,NULL)",
                (qid, slot["figKey"], None, f"fill:{source}:{Path(src).name}",
                 f"assets/{dest.name}", f"视觉选图补全：{reason}",
                 min(conf, 0.85)))
            db.commit()
            filled += 1
            print(f"  ✓ {qid} fig{slot['figKey']} [{source}] conf={conf:.2f} {reason}",
                  flush=True)
    print(f"补全完成：{filled} 槽已补（待复核），{failed} 槽未找到合适图")


def cmd_fix2(workers=3):
    """错配深度修复：用 Word→PDF 页面/原页面重新框选，替换错配配图。"""
    from fig_backfill import detect_figures, BOX_CACHE
    from PIL import Image
    db = get_db()
    rows = db.execute("""
        SELECT f.id, f.qid, f.figKey, f.imagePath, f.note, f.page, q.stem, q.subQuestions,
               q.answerText, q.paperId
        FROM figures f JOIN questions q ON q.qid = f.qid
        WHERE f.matchStatus = 'suspect'
        ORDER BY f.qid""").fetchall()
    print(f"待深度修复错配: {len(rows)} 条")
    papers = {r["paperId"]: dict(r) for r in db.execute("SELECT * FROM papers")}
    # 预转换 Word 卷（串行）
    page_cache = {}
    for pid in dict.fromkeys(r["paperId"] for r in rows):
        paper = papers.get(pid)
        if paper and paper_word_files(paper):
            print(f"  预处理 Word→PDF: {pid}", flush=True)
            page_cache[pid] = get_paper_pages(paper)

    def candidates_for(row):
        paper = papers.get(row["paperId"])
        if not paper:
            return []
        pid = paper["paperId"]
        if pid not in page_cache:
            page_cache[pid] = get_paper_pages(paper)
        pages = page_cache[pid]
        stem_text = collect_subq_stems(row)
        desc = fig_description(stem_text, row["figKey"])
        labels = re.findall(r"图\s*(\d+[甲乙丙丁]?|[甲乙丙丁])",
                            desc + " " + (stem_text or "")[:200])
        target = []
        for lb in labels:
            for pg in pages:
                if re.search(rf"图\s*{re.escape(lb)}(?![\d甲乙丙丁])", pg["text"] or ""):
                    target.append(pg)
        if not target:
            target = pages
        tmp = FIX_CACHE / ("f2_" + hashlib.md5(
            (pid + row["qid"] + row["figKey"]).encode()).hexdigest()[:12])
        tmp.mkdir(parents=True, exist_ok=True)
        out = []
        for page_index, pg in enumerate(target):
            ip = str(pg["image"])
            if not Path(ip).exists():
                continue
            # 深度修复：清掉该页框缓存重新检测（带上图编号提示）
            bc = BOX_CACHE / (hashlib.md5(ip.encode()).hexdigest()[:12] + ".json")
            bak = None
            if bc.exists() and labels and not bc.with_suffix('.redo').exists():
                bak = bc.with_suffix(".redo")
                bc.rename(bak)   # 备份旧缓存，触发带提示的重检
            try:
                boxes = detect_figures(ip, set(labels))
            except Exception:
                continue
            if not boxes and bak and bak.exists():
                bak.rename(bc)   # 重检失败回滚旧缓存
                try:
                    boxes = detect_figures(ip, set(labels))
                except Exception:
                    boxes = []
            with Image.open(ip) as im:
                W, H = im.size
                for i, fb in enumerate(boxes):
                    box = fb.get("box")
                    if not box or len(box) != 4:
                        continue
                    x0, y0, x1, y1 = [max(0.0, min(1.0, float(v))) for v in box]
                    if x1 - x0 < 0.03 or y1 - y0 < 0.03:
                        continue
                    dest = tmp / f"p{page_index}_{i:02d}.png"
                    im.crop((int(x0 * W), int(y0 * H),
                             int(x1 * W), int(y1 * H))).save(dest)
                    out.append(dest)
        return out, stem_text, desc

    def work(row):
        c = candidates_for(row)
        if not c or not c[0]:
            return row, None
        cands, stem_text, desc = c
        stem_brief = re.sub(r"\{\{(fig|blank):\d+\}\}", "", stem_text)[:4000]
        return row, pick_best_candidate(cands, stem_brief, desc or "本题插图")

    fixed = failed = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for row, r in ex.map(work, rows):
            if not r:
                failed += 1
                continue
            src, conf, reason = r
            qid = row["qid"]
            safe = re.sub(r"[#\s]", "_", qid)
            dest = ASSETS / f"{safe}_fig{row['figKey']}{Path(src).suffix.lower()}"
            dest.write_bytes(Path(src).read_bytes())
            db.execute("""UPDATE figures SET imagePath=?, cropConfidence=?,
                          matchStatus=NULL, note=?, page=? WHERE id=?""",
                       (f"assets/{dest.name}", min(conf, 0.85),
                        f"深度重裁：{reason}",
                        f"fix2:{Path(src).name}", row["id"]))
            db.commit()
            fixed += 1
            print(f"  ✓ {qid} fig{row['figKey']} 重裁 conf={conf:.2f} {reason}",
                  flush=True)
    print(f"深度修复完成：{fixed} 条重裁待复核，{failed} 条仍无合适候选")


def cmd_report():
    db = get_db()
    rows = db.execute("""
        SELECT qid, figKey, imagePath, page, note FROM figures
        WHERE matchStatus = 'suspect' ORDER BY qid""").fetchall()
    print(f"错配/存疑配图共 {len(rows)} 张：")
    for r in rows:
        print(f"  {r['qid']} fig{r['figKey']}  [{r['page']}]  {r['imagePath']}")
    ok = db.execute("SELECT COUNT(*) FROM figures WHERE matchStatus='ok'").fetchone()[0]
    un = db.execute("SELECT COUNT(*) FROM figures WHERE matchStatus IS NULL OR matchStatus='unchecked'").fetchone()[0]
    print(f"（匹配 {ok} / 未核对 {un}）")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["detect", "fix", "fix2", "fill", "report"])
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--paper", help="仅补全指定试卷")
    ap.add_argument("--recheck", action="store_true", help="复核已有状态（内容哈希缓存仍可复用）")
    a = ap.parse_args()
    if a.cmd == "detect":
        cmd_detect(a.workers, a.limit, a.recheck, a.paper)
    elif a.cmd == "fix":
        cmd_fix(a.workers)
    elif a.cmd == "fill":
        cmd_fill(a.workers, a.limit, a.paper)
    elif a.cmd == "fix2":
        cmd_fix2(a.workers)
    else:
        cmd_report()


if __name__ == "__main__":
    main()
