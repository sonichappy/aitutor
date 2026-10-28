#!/usr/bin/env python3
"""试点错配图修复：对 suspect 配图从原卷重新视觉选图替换；
仍无匹配则删除图记录并还原题干（去掉 {{fig:k}} 占位，保留原引图文字）。

用法：
  python3 fig_fix_suspect.py --paper "江苏-2015-2015苏州" [--paper ...]
"""
import argparse
import base64
import io
import json
import re
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kimi_pipeline import ROOT, BANK, DB_PATH, MODEL, load_inventory
from fig_backfill import (LABEL_RE, QNUM_RE, group_pages, pick_best,
                          detect_figures, question_texts, safe_name,
                          box_confidence, _img_mime)
from fig_backfill_prose import crop_of, vision_pick
from fig_verify import verify_one, collect_subq_stems
from PIL import Image

ASSETS = BANK / "assets"


def paper_pages(paper, groups_by_id):
    gid = pick_best(paper["questionGroups"], groups_by_id)
    if not gid:
        return None, []
    channel, pages = group_pages(gid)
    return channel, pages


def fix_paper(db, paper, groups_by_id):
    pid = paper["paperId"]
    channel, pages = paper_pages(paper, groups_by_id)
    if not pages:
        print(f"[{pid}] 无页面图，跳过", file=sys.stderr)
        return 0, 0, 0
    page_figs = {}
    for page in pages:
        try:
            page_figs[page["key"]] = detect_figures(page["image"], set())
        except Exception as e:
            print(f"[{pid}] 页 {page['key']} 检测失败: {e}", file=sys.stderr)
            page_figs[page["key"]] = []

    rows = db.execute("""
        SELECT f.id, f.qid, f.figKey, f.imagePath, f.note, f.page, f.label,
               q.number, q.stem, q.subQuestions, q.answerText
        FROM figures f JOIN questions q ON q.qid=f.qid
        WHERE q.paperId=? AND f.matchStatus='suspect'""", (pid,)).fetchall()
    fixed = removed = reok = 0
    for r in rows:
        qrow = {"stem": r["stem"], "subQuestions": r["subQuestions"]}
        qtext = " ".join(question_texts(qrow))[:600]
        # 候选：全卷检测到的所有插图框（含已被占用的，允许换）
        pool = [(f, pg) for pg in pages for f in page_figs.get(pg["key"], [])]
        new_fig = new_page = None
        for start in range(0, len(pool), 8):
            batch = pool[start:start + 8]
            crops = []
            for f, pg in batch:
                buf = io.BytesIO()
                crop_of(f, pg).save(buf, format="PNG")
                crops.append(buf.getvalue())
            k = vision_pick(qtext, crops)
            if k >= 0:
                new_fig, new_page = batch[k]
                break
        if new_fig is None:
            # 删除错图，还原题干
            db.execute("DELETE FROM figures WHERE id=?", (r["id"],))
            stem = r["stem"] or ""
            new_stem = re.sub(r"\{\{fig:%s\}\}" % re.escape(str(r["figKey"])), "", stem)
            if new_stem != stem:
                db.execute("UPDATE questions SET stem=? WHERE qid=?", (new_stem, r["qid"]))
            p = ASSETS / Path(r["imagePath"]).name
            if p.exists():
                p.unlink()
            removed += 1
            print(f"[{pid}#{r['number']}] fig{r['figKey']} 无替代候选，已删除还原",
                  file=sys.stderr)
            continue
        # 替换图文件与记录
        crop = crop_of(new_fig, new_page)
        p = ASSETS / Path(r["imagePath"]).name
        crop.save(p)
        conf = box_confidence(new_fig["box"])
        if (new_fig["box"][2] - new_fig["box"][0]) < 0.08:
            conf = min(conf, 0.5)
        db.execute("UPDATE figures SET label=?, page=?, note=?, cropConfidence=? WHERE id=?",
                   (new_fig.get("label"), new_page["key"],
                    new_fig.get("desc", ""), conf, r["id"]))
        # 复核一次
        vstatus, _reason = verify_one(
            {"qid": r["qid"], "figKey": r["figKey"], "imagePath": r["imagePath"],
             "note": new_fig.get("desc", "")},
            collect_subq_stems({"stem": r["stem"], "subQuestions": r["subQuestions"],
                                "answerText": r["answerText"]}))
        if vstatus not in ("ok", "suspect"):
            vstatus = "unchecked"
        db.execute("UPDATE figures SET matchStatus=? WHERE id=?", (vstatus, r["id"]))
        fixed += 1
        if vstatus == "ok":
            reok += 1
        else:
            print(f"[{pid}#{r['number']}] fig{r['figKey']} 重选后仍 {vstatus}",
                  file=sys.stderr)
        db.commit()
    db.commit()
    print(f"[{pid}] 修复 {fixed}（复核ok {reok}）/ 删除 {removed}", file=sys.stderr)
    return fixed, removed, reok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", action="append", required=True)
    args = ap.parse_args()
    inv, groups_by_id, papers_by_id = load_inventory()
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    tf = tr = tok = 0
    for pid in args.paper:
        paper = papers_by_id.get(pid)
        if not paper:
            print(f"!! 未知试卷 {pid}", file=sys.stderr)
            continue
        f, r, ok = fix_paper(db, paper, groups_by_id)
        tf += f; tr += r; tok += ok
    print(json.dumps({"fixed": tf, "removed": tr, "recheck_ok": tok},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
