#!/usr/bin/env python3
"""缺图题摸底：统计每道有 {{fig:}} 占位但无配图记录的题，检查源卷是否存在可用图像资源，
判定"可补"（有图源）还是"不可补"（源文件无图）。

用法：python3 fig_gap_survey.py [--json]
"""
import hashlib
import json
import re
import sqlite3
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kimi_pipeline import ROOT, STATE, OCR_DIR, BANK, DB_PATH, IMG_EXT, load_inventory

FIG_RE = re.compile(r"\{\{fig:(\d+)\}\}")


def missing_slots(db):
    """返回 {paperId: [(qid, figKey)]}——有占位但 figures 表无记录的槽位。"""
    out = {}
    rows = db.execute(
        "SELECT qid, paperId, stem, subQuestions, answerText FROM questions "
        "WHERE stem LIKE '%{{fig:%' OR subQuestions LIKE '%{{fig:%' "
        "OR answerText LIKE '%{{fig:%'").fetchall()
    for qid, pid, stem, subs, ans in rows:
        keys = set(FIG_RE.findall((stem or "") + (subs or "") + (ans or "")))
        have = {r[0] for r in db.execute(
            "SELECT figKey FROM figures WHERE qid=?", (qid,))}
        miss = keys - have
        if miss:
            out.setdefault(pid, []).extend((qid, k) for k in sorted(miss, key=int))
    return out


def ocr_channel(gid):
    cache = STATE / "ocr" / (hashlib.md5(gid.encode()).hexdigest()[:10] + ".json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8")).get("source")
    return None


def docx_image_counts(path):
    """返回 (media图片数, VML图数)。"""
    try:
        z = zipfile.ZipFile(str(path))
        media = [n for n in z.namelist() if n.startswith("word/media/")
                 and Path(n).suffix.lower() in (".png", ".jpg", ".jpeg", ".gif", ".bmp")]
        vml = 0
        for n in z.namelist():
            if n.endswith(".xml") and ("document" in n or "header" in n or "footer" in n):
                xml = z.read(n).decode("utf-8", errors="replace")
                vml += xml.count("<v:imagedata")
        return len(media), vml
    except Exception:
        return 0, 0


def doc_carve_count(path):
    """快速统计 .doc 中可抠出的图片数（按魔数+大小，不写文件）。"""
    data = Path(path).read_bytes()
    n = 0
    for m in re.finditer(b"\xff\xd8\xff", data):
        e = data.find(b"\xff\xd9", m.start())
        if e > 0 and e - m.start() > 6000:
            n += 1
    for m in re.finditer(b"\x89PNG\r\n\x1a\n", data):
        e = data.find(b"IEND\xaeB`\x82", m.start())
        if e > 0 and e - m.start() > 6000:
            n += 1
    return n


def survey_paper(db, pid, papers_by_id, groups_by_id):
    """检查一套卷的图像资源，返回 (verdict, method, detail)。"""
    p = papers_by_id.get(pid)
    if not p:
        return "不可补", "-", "试卷记录缺失"
    gids = []
    gids += p.get("questionGroups") or []
    try:
        ag = p.get("answerGroups") or []
        gids += ag if isinstance(ag, list) else json.loads(ag)
    except (json.JSONDecodeError, TypeError):
        pass

    has_page_images = False   # 有页面级图（扫描件/渲染页/docx抽图）→ 视觉裁剪
    n_media = n_vml = n_carve = 0
    channels = []
    for gid in dict.fromkeys(gids):
        g = groups_by_id.get(gid)
        if not g:
            continue
        ch = ocr_channel(gid)
        channels.append(ch)
        src = ROOT / gid
        # 组目录下的实际文件（inventory 不存文件清单，直接扫目录）
        files = []
        if src.is_file():
            files = [src]
        elif src.is_dir():
            files = [f for f in src.rglob("*") if f.is_file()
                     and f.suffix.lower() in (".doc", ".docx", ".pdf")
                     and not f.name.startswith("~$")]
        # 页面图资源
        if ch in ("images", "docx-images", "doc-images", "pdf-scan", "pdf-text"):
            has_page_images = True
        elif ch is None:
            if src.is_dir() and any(f.suffix.lower() in IMG_EXT
                                    for f in src.iterdir() if f.is_file()):
                has_page_images = True
            if any(f.suffix.lower() == ".pdf" for f in files):
                has_page_images = True
        # docx 内嵌图 / VML
        for f in files:
            ext = f.suffix.lower()
            if ext == ".docx":
                m, v = docx_image_counts(f)
                n_media += m
                n_vml += v
            elif ext == ".doc":
                n_carve += doc_carve_count(f)

    parts = []
    if n_media:
        parts.append(f"docx内嵌图{n_media}张")
    if n_vml:
        parts.append(f"VML图{n_vml}处")
    if n_carve:
        parts.append(f"doc可抠{n_carve}张")
    if has_page_images:
        parts.append("有页面图")

    if has_page_images:
        return "可补", "页面图视觉裁剪", "；".join(parts) or "页面图"
    if n_media:
        return "可补", "docx锚点配对/重配", "；".join(parts)
    if n_vml:
        return "可补", "需新增VML解析", "；".join(parts)
    if n_carve:
        return "可补", "doc抠图(视觉选图重配)", "；".join(parts)
    return "不可补", "-", f"源文件纯文字无图（通道{channels}）"


def main():
    db = sqlite3.connect(DB_PATH)
    inv, groups_by_id, papers_by_id = load_inventory()
    gaps = missing_slots(db)
    total_q = len({qid for slots in gaps.values() for qid, _ in slots})
    total_slots = sum(len(v) for v in gaps.values())
    print(f"缺图题共 {total_q} 道 / {total_slots} 个图槽，分布于 {len(gaps)} 套卷\n")

    can, cannot = [], []
    for pid in sorted(gaps, key=lambda x: -len(gaps[x])):
        verdict, method, detail = survey_paper(db, pid, papers_by_id, groups_by_id)
        n_q = len({qid for qid, _ in gaps[pid]})
        entry = (pid, n_q, len(gaps[pid]), method, detail)
        (can if verdict == "可补" else cannot).append(entry)

    can_q = sum(e[1] for e in can)
    cannot_q = sum(e[1] for e in cannot)
    print(f"== 可补：{len(can)} 套卷 / {can_q} 题 ==")
    for pid, nq, ns, method, detail in can:
        print(f"  {pid}: {nq}题/{ns}槽  [{method}]  {detail}")
    print(f"\n== 不可补：{len(cannot)} 套卷 / {cannot_q} 题 ==")
    for pid, nq, ns, method, detail in cannot:
        print(f"  {pid}: {nq}题/{ns}槽  {detail}")
    print(f"\n汇总：可补 {can_q} 题，不可补 {cannot_q} 题")


if __name__ == "__main__":
    main()
