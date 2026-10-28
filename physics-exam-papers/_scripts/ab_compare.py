#!/usr/bin/env python3
"""Kimi vs MiMo A/B 对比：对 Kimi 已入库的试卷，用当前供应商(MiMo)重跑 OCR+结构化。

安全措施：
- 正式库的 OCR/结构化缓存不含模型名，直接重跑会命中 Kimi 旧缓存，
  因此把 kp.STATE / kp.OCR_DIR 重定向到 _state/ab_compare/ 沙盒，全部全新计算；
- 只读 question-bank/physics.db（取 Kimi 基准），绝不写入；
- 结果写入 _state/ab_compare/result.json。
"""
import argparse
import difflib
import hashlib
import json
import os
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import kimi_pipeline as kp

ROOT = Path(__file__).resolve().parent.parent
REAL_STATE = ROOT / "_state"
REAL_OCR = REAL_STATE / "ocr"
DB_PATH = ROOT / "question-bank" / "physics.db"

# 三套样本：图片版通道 / 下载版解压(老卷) / 下载版解压(新卷，含混合答案组)
# 注意：结构化为重调用，全套跑完耗时很长；先用第 1 套出结果，其余可后续加入续跑。
PAPERS = ["北京-2017-2017北京"]
# PAPERS = ["北京-2017-2017北京", "北京-2005-2005北京", "内蒙古-2022-2022内蒙古赤峰"]

PROVIDERS = {
    "mimo": {"base_url": "https://api.xiaomimimo.com/v1", "model": "mimo-v2.6-flash"},
    "deepseek": {"base_url": "https://api.deepseek.com/v1", "model": "deepseek-flash"},
}


def norm(s):
    return re.sub(r"\s+", "", s or "")


def fig_slots(texts):
    return sum(len(re.findall(r"\{\{fig:\d+\}\}|\[图\d+\]", t or "")) for t in texts)


def sort_nums(nums):
    return sorted(nums, key=lambda x: (len(x), x))


def read_group_cache(ocr_root, gid):
    p = ocr_root / (hashlib.md5(gid.encode()).hexdigest()[:10] + ".json")
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", choices=list(PROVIDERS), default="mimo")
    ap.add_argument("--papers", nargs="*", default=None,
                    help="覆盖默认 PAPERS 列表（如：--papers 江苏-2014-2014苏州）")
    args = ap.parse_args()
    papers = args.papers if args.papers else PAPERS
    cfg = PROVIDERS[args.provider]
    sandbox = REAL_STATE / f"ab_compare_{args.provider}"

    kp.BASE_URL = cfg["base_url"]
    kp.MODEL = cfg["model"]
    if args.provider == "mimo":
        kp.API_KEY = os.environ.get("MIMO_API_KEY", kp.API_KEY)
    else:
        kp.API_KEY = os.environ[f"{args.provider.upper()}_API_KEY"]

    inv, groups_by_id, papers_by_id = kp.load_inventory()  # 必须用真实 STATE 读

    # 重定向缓存到沙盒（在 import 后、跑任何 OCR 前）
    kp.STATE = sandbox
    kp.OCR_DIR = sandbox / "ocr"

    # 包装 chat：记录 JSON 合法率与 token 用量
    calls = []
    real_chat = kp.chat

    def chat_logged(messages, max_tokens=8192, json_mode=False, retries=3, effort=None):
        # deepseek-flash 是推理模型：规划调用默认 2048 token 会被 reasoning 吃光、
        # content 为空导致 JSON 解析失败，因此对该调用放大输出上限。
        if max_tokens <= 2048:
            max_tokens = 8192
        content, usage = real_chat(messages, max_tokens=max_tokens,
                                   json_mode=json_mode, retries=retries, effort=effort)
        entry = {"max_tokens": max_tokens, "json_mode": json_mode,
                 "chars": len(content or ""), "usage": usage}
        if json_mode:
            try:
                kp.extract_json(content)
                entry["json_ok"] = True
            except Exception as e:
                entry["json_ok"] = False
                entry["json_err"] = str(e)[:120]
        calls.append(entry)
        return content, usage

    kp.chat = chat_logged

    db = sqlite3.connect(DB_PATH)
    report = {"model": kp.MODEL, "provider": args.provider, "base_url": kp.BASE_URL, "papers": {}}

    for pid in papers:
        if pid not in papers_by_id:
            print(f"[skip] {pid} 不在 inventory", file=sys.stderr)
            continue
        paper = papers_by_id[pid]
        rec = {"paperId": pid}

        # ---- Kimi 基准（DB 只读）----
        kq = db.execute(
            "select number, type, stem, answerChoice, answerStatus from questions where paperId=?",
            (pid,)).fetchall()
        kimi_nums = {str(r[0]) for r in kq}
        kimi_stem = {str(r[0]): r[2] or "" for r in kq}
        kimi_ans = {str(r[0]): (r[3] or "") for r in kq if r[3]}
        rec["kimi"] = {
            "n_questions": len(kq),
            "n_numbers": len(kimi_nums),
            "fig_slots": fig_slots([r[2] for r in kq]),
            "official_answers": sum(1 for r in kq if r[4] == "official"),
        }
        qgid = kp.pick_best(paper["questionGroups"], groups_by_id)
        rec["question_group"] = qgid
        kcache = read_group_cache(REAL_OCR, qgid) if qgid else None
        if kcache:
            rec["kimi"]["ocr_source"] = kcache.get("source")
            rec["kimi"]["ocr_pages"] = len(kcache.get("pages", []))
            rec["kimi"]["ocr_chars"] = sum(len(p) for p in kcache.get("pages", []))

        # ---- 候选模型重跑 ----
        n0 = len(calls)
        try:
            questions, meta = kp.structure_paper(paper, groups_by_id)
            mnums = {str(q.get("number")) for q in questions}
            mcache = read_group_cache(sandbox / "ocr", qgid) if qgid else None
            rec["cand"] = {
                "ok": True,
                "n_questions": len(questions),
                "n_numbers": len(mnums),
                "fig_slots": fig_slots([q.get("stem") or "" for q in questions]),
                "ocr_source": (mcache or {}).get("source"),
                "ocr_pages": len((mcache or {}).get("pages", [])),
                "ocr_chars": sum(len(p) for p in (mcache or {}).get("pages", [])),
            }
            # ---- 对比 ----
            inter = mnums & kimi_nums
            sims = []
            for q in questions:
                n = str(q.get("number"))
                if n in kimi_stem:
                    a, b = norm(kimi_stem[n]), norm(q.get("stem") or "")
                    if a and b:
                        sims.append(difflib.SequenceMatcher(None, a, b).ratio())
            agree = tot = 0
            for q in questions:
                n = str(q.get("number"))
                ma = (q.get("answer") or {}).get("choice")
                if n in kimi_ans and ma and str(ma).strip():
                    tot += 1
                    if str(ma).strip().upper() == str(kimi_ans[n]).strip().upper():
                        agree += 1
            rec["compare"] = {
                "number_recall": round(len(inter) / max(1, len(kimi_nums)), 3),
                "missing_in_cand": sort_nums(kimi_nums - mnums)[:25],
                "extra_in_cand": sort_nums(mnums - kimi_nums)[:25],
                "stem_sim_mean": round(sum(sims) / len(sims), 3) if sims else None,
                "stem_sim_n": len(sims),
                "choice_agree": f"{agree}/{tot}" if tot else "n/a",
            }
        except Exception as e:
            rec["cand"] = {"ok": False, "error": str(e)[:300]}
        rec["calls"] = calls[n0:]
        report["papers"][pid] = rec
        print(f"[done] {pid}: kimi={rec['kimi'].get('n_questions')}题 "
              f"cand={'OK' if rec['cand'].get('ok') else 'FAIL'}", file=sys.stderr)

    # 汇总
    total_calls = [c for p in report["papers"].values() for c in p.get("calls", [])]
    jcalls = [c for c in total_calls if c.get("json_mode")]
    report["summary"] = {
        "model": kp.MODEL,
        "provider": args.provider,
        "n_calls": len(total_calls),
        "json_calls": len(jcalls),
        "json_ok": sum(1 for c in jcalls if c.get("json_ok")),
        "prompt_tokens": sum((c["usage"] or {}).get("prompt_tokens", 0) for c in total_calls),
        "completion_tokens": sum((c["usage"] or {}).get("completion_tokens", 0) for c in total_calls),
    }
    sandbox.mkdir(parents=True, exist_ok=True)
    (sandbox / "result.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(report["summary"], ensure_ascii=False), file=sys.stderr)


if __name__ == "__main__":
    main()
