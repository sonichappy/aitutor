#!/usr/bin/env python3
"""配图补全流水线：为已入库题目从原卷页面图中裁剪插图，写入 question-bank/assets 与 figures 表。

支持通道：images / docx-images / doc-images / pdf-text / pdf-scan（有页面图的）。
纯文本 word 卷（doc/docx 正文型）跳过，占位保留。

用法：
  python3 fig_backfill.py              # 全部含图卷（断点续跑）
  python3 fig_backfill.py --paper "北京-2018-2018北京"
"""
import argparse
import base64
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kimi_pipeline import (ROOT, STATE, OCR_DIR, BANK, DB_PATH, IMG_EXT,
                           BASE_URL, API_KEY, MODEL, pick_best, load_inventory,
                           pdf_to_images, chat)

ASSETS = BANK / "assets"
BOX_CACHE = STATE / "figboxes"

BOX_PROMPT = """这是一页中考物理试卷扫描件。请找出本页中所有【插图】（实验装置图、电路图、坐标图、照片、示意图等，不含纯文字表格），以 JSON 输出：
{{"figures": [{{"label": "图17", "desc": "一句话描述", "box": [x0, y0, x1, y1]}}]}}
- label：图上印的编号（如 图17、图18甲），无编号则给简短名
- box：归一化坐标 [左, 上, 右, 下]，0-1 之间，恰好框住插图区域（含图内标注），不要包含插图外的正文文字行
{hint}
- 只输出 JSON"""

from figure_slots import slots, valid_keys, text_fields

FIG_RE = re.compile(r"\{\{fig:(\d+)\}\}")
LABEL_RE = re.compile(r"图\s*(\d+[甲乙丙丁]?)")
QNUM_RE = re.compile(r"第\s*(\d+)\s*题图")


def _img_mime(b):
    if b[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if b[:4] == b"GIF8":
        return "image/gif"
    if b[:2] == b"BM":
        return "image/bmp"
    return "image/png"


def vision_pick(question_text, cand_bytes_list):
    """视觉选图：给定题目文本和候选图字节列表，返回最佳下标；-1 表示都不匹配。"""
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
        r, _usage = chat([{"role": "user", "content": content}],
                         max_tokens=1024, json_mode=False, retries=2)
        r = (r or "").strip()
        m = re.search(r"-?\d+", r)
        if not m:
            return -1
        k = int(m.group(0))
        return k if -1 <= k < len(cand_bytes_list) else -1
    except Exception as e:
        print(f"  [warn] 视觉选图失败: {e}", file=sys.stderr)
        return -1


def norm(s):
    s = re.sub(r"\{\{(fig|blank):\d+\}\}", "", s or "")
    s = re.sub(r"\$|\\[a-zA-Z]+|[\s_{}（）()，。、．.：:；;《》<>\[\]|/\\-]", "", s)
    return s


def get_db():
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.execute("""CREATE TABLE IF NOT EXISTS figures(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qid TEXT, figKey TEXT, label TEXT, page TEXT,
      imagePath TEXT, note TEXT, cropConfidence REAL,
      UNIQUE(qid, figKey))""")
    return db


# ---------------------------------------------------------------- 页面获取

def group_pages(group_id):
    """返回 [{key, image, text}]，image 为页面图绝对路径，text 为该页 OCR/提取文本。"""
    src = ROOT / group_id
    gid_hash = hashlib.md5(group_id.encode()).hexdigest()[:10]
    cache = OCR_DIR / f"{gid_hash}.json"
    channel = None
    if cache.exists():
        channel = json.loads(cache.read_text(encoding="utf-8")).get("source")

    pages = []

    def read_md(*parts):
        p = OCR_DIR.joinpath(*parts)
        return p.read_text(encoding="utf-8") if p.exists() else ""

    if channel == "images" or (channel is None and src.is_dir() and
                               {f.suffix.lower() for f in src.iterdir() if f.is_file()} & IMG_EXT):
        for f in sorted(src.iterdir()):
            if f.is_file() and f.suffix.lower() in IMG_EXT:
                pages.append({"key": f.stem, "image": f,
                              "text": read_md("pages", gid_hash, f.stem + ".md")})
    elif channel in ("docx-images", "doc-images"):
        # 图片在 docx_media/doc_media/doc_carve 下，OCR 文本在 pages/{hash}/{docstem}/
        page_root = OCR_DIR / "pages" / gid_hash
        for sub in sorted(page_root.iterdir()) if page_root.exists() else []:
            if not sub.is_dir():
                continue
            for md in sorted(sub.glob("*.md")):
                img = None
                for base in ("docx_media", "doc_media", "doc_carve"):
                    cand_dir = OCR_DIR / base / gid_hash / sub.name
                    if cand_dir.exists():
                        for ext in ("png", "jpg", "jpeg"):
                            c = cand_dir / f"{md.stem}.{ext}"
                            if c.exists():
                                img = c
                                break
                    if img:
                        break
                if img:
                    pages.append({"key": f"{sub.name}/{md.stem}", "image": img,
                                  "text": md.read_text(encoding="utf-8")})
    elif channel in ("pdf-text", "pdf-scan") or (channel is None and src.suffix.lower() == ".pdf"):
        pdf = src if src.is_file() else next(iter(src.glob("*.pdf")), None)
        if pdf is None:
            return channel, []
        img_dir = OCR_DIR / "rendered" / gid_hash
        imgs = sorted(img_dir.glob("page*.png"))
        if not imgs:
            imgs = pdf_to_images(pdf, img_dir)
        if channel == "pdf-text":
            import pdfplumber
            with pdfplumber.open(str(pdf)) as doc:
                texts = [(pg.extract_text() or "") for pg in doc.pages]
        else:
            texts = [read_md("pages", gid_hash, im.stem + ".md") for im in imgs]
        for im, t in zip(imgs, texts):
            pages.append({"key": im.stem, "image": im, "text": t})
    return channel, pages


# ---------------------------------------------------------------- 题目→页映射

def question_texts(q):
    """题目的全部文本（题干+子题题干），用于页匹配。"""
    return list(text_fields(dict(q)))


def map_question_page(q, pages):
    """返回最可能的页面对象，失败返回 None。"""
    stems = question_texts(q)
    labels = set()
    for s in stems:
        labels |= set(LABEL_RE.findall(s))
    # 图号法：候选页含图号，优先含 [图 占位（图实际所在页）
    if labels:
        cands = [p for p in pages if labels & set(LABEL_RE.findall(p["text"]))]
        if len(cands) == 1:
            return cands[0]
        with_ph = [p for p in cands if re.search(r"\[图\d", p["text"])]
        if with_ph:
            return with_ph[0]
        if cands:
            return cands[0]
    # 题干前缀法
    probe = norm(stems[0])[:18]
    if probe:
        for p in pages:
            if probe in norm(p["text"]):
                return p
    return None


# ---------------------------------------------------------------- 视觉定位

def detect_figures(image_path, expected_labels):
    BOX_CACHE.mkdir(parents=True, exist_ok=True)
    cache = BOX_CACHE / hashlib.md5(str(image_path).encode()).hexdigest()[:12]
    cache_file = cache.with_suffix(".json")
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))
    hint = ""
    if expected_labels:
        hint = "- 本页预期包含以下图编号，请特别注意不要遗漏：" + "、".join(
            f"图{x}" for x in sorted(expected_labels))
    b64 = base64.b64encode(Path(image_path).read_bytes()).decode()
    ext = Path(image_path).suffix.lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext, "image/png")
    # deepseek-flash 等推理模型的 reasoning 可能吃掉输出预算导致 content 为空，
    # 逐次放大 max_tokens 重试（4096 → 8192 → 16384）
    for attempt, mt in enumerate((4096, 8192, 16384)):
        payload = {"model": MODEL, "max_tokens": mt,
                   "reasoning_effort": "low",  # 图框定位是简单视觉任务，低推理省token
                   "messages": [{"role": "user", "content": [
                       {"type": "text", "text": BOX_PROMPT.format(hint=hint)},
                       {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}}]}]}
        try:
            r = requests.post(f"{BASE_URL}/chat/completions",
                              headers={"Authorization": f"Bearer {API_KEY}"},
                              json=payload, timeout=180)
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(10 * (attempt + 1))
                continue
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            if not content or "{" not in content:
                raise ValueError(f"empty/无JSON输出 (max_tokens={mt})")
            m = re.search(r"\{.*\}", content, re.DOTALL)
            data = json.loads(m.group(0))
            figs = data.get("figures", [])
            cache_file.write_text(json.dumps(figs, ensure_ascii=False), encoding="utf-8")
            return figs
        except Exception as e:
            if attempt == 2:
                raise
            print(f"  [retry] 视觉定位 {e}", file=sys.stderr)
            time.sleep(8)
    return []


# ---------------------------------------------------------------- docx 内嵌图提取（纯文本 docx 卷）

def docx_media_with_anchors(docx_path):
    """解析 document.xml，返回 (全文文本, [(字符偏移, rid, 媒体文件名)])。"""
    import zipfile
    z = zipfile.ZipFile(str(docx_path))
    doc_xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    rels_xml = z.read("word/_rels/document.xml.rels").decode("utf-8", errors="replace")
    rid2target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))
    anchors = []
    text_parts, pos = [], 0
    for pm in re.finditer(r"<w:p[ >].*?</w:p>", doc_xml, re.DOTALL):
        para = pm.group(0)
        texts = re.findall(r"<w:t[^>]*>([^<]*)</w:t>", para)
        ptext = "".join(texts)
        embeds = re.findall(r'r:embed="([^"]+)"', para)
        text_parts.append(ptext)
        pos += len(ptext) + 1  # +1 为换行
        for rid in embeds:
            target = rid2target.get(rid, "")
            name = target.split("/")[-1]
            if name:
                anchors.append((pos - 1, name))
    return "\n".join(text_parts), anchors, z


def extract_media(z, name, out_dir):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = z.read(f"word/media/{name}")
    p = out_dir / name
    p.write_bytes(data)
    return p


def norm_with_map(s):
    """归一化文本，同时返回 norm位置->原文偏移 的映射。"""
    out, imap = [], []
    for i, ch in enumerate(s):
        if re.match(r"[\s\$\\_{}（）()，。、．.：:；;《》<>\[\]|/\-—~·’'\"\"]", ch):
            continue
        out.append(ch)
        imap.append(i)
    return "".join(out), imap


WATERMARKS_FILE = STATE / "watermarks.json"


def build_watermark_set(min_dirs=3):
    """跨文档频次分析：同一图片哈希出现在 ≥min_dirs 个不同文档中即判定为水印 Logo。"""
    base = OCR_DIR / "doc_figs"
    hash_dirs = {}
    if base.exists():
        for d in base.iterdir():
            if not d.is_dir():
                continue
            for f in d.rglob("*"):
                if f.is_file() and f.suffix.lower() in IMG_EXT:
                    h = hashlib.md5(f.read_bytes()).hexdigest()
                    hash_dirs.setdefault(h, set()).add(d.name + f.parent.name)
    wm = sorted(h for h, ds in hash_dirs.items() if len(ds) >= min_dirs)
    WATERMARKS_FILE.write_text(json.dumps(wm), encoding="utf-8")
    return wm


def load_watermarks():
    if WATERMARKS_FILE.exists():
        return set(json.loads(WATERMARKS_FILE.read_text()))
    return set()


def process_paper_doc_carve(db, paper, groups_by_id):
    """文本型 .doc 卷：从 OLE 二进制抠出内嵌小图，按题号顺序配对（顺序法，置信度较低）。"""
    from kimi_pipeline import carve_doc_images
    pid = paper["paperId"]
    gid = pick_best(paper["questionGroups"], groups_by_id)
    src = ROOT / gid
    docs = sorted(src.glob("*.doc")) if src.is_dir() else []
    if not docs:
        return 0
    gid_hash = hashlib.md5(gid.encode()).hexdigest()[:10]
    imgs = carve_doc_images(docs[0], OCR_DIR / "doc_figs" / gid_hash,
                            min_bytes=6000, min_dim=60)
    # 统计出现频次：水印 Logo 在文档中逐页重复，频次高
    from collections import Counter as _Counter
    freq = _Counter(hashlib.md5(p.read_bytes()).hexdigest() for p in imgs)
    watermarks = load_watermarks()
    # 按内容去重（OLE 常存两份），并剔除高频水印/全局水印
    seen, uniq = set(), []
    for p in imgs:
        h = hashlib.md5(p.read_bytes()).hexdigest()
        if h in seen or freq[h] >= 3 or h in watermarks:
            continue
        seen.add(h)
        uniq.append(p)
    # 过滤水印/整页图：高度过大且竖长（如整页 Logo 水印）
    from PIL import Image
    real = []
    for p in uniq:
        try:
            with Image.open(p) as im:
                w, h = im.size
            if h >= 600 and h / max(w, 1) > 1.1:
                continue  # 整页水印/页面图
            real.append(p)
        except Exception:
            continue
    if not real:
        return 0

    rows = db.execute(
        "SELECT qid, number, stem, subQuestions, options, answerText FROM questions "
        "WHERE paperId=? AND (stem LIKE '%{{fig:%' OR subQuestions LIKE '%{{fig:%') "
        "ORDER BY CAST(number AS INT)", (pid,)).fetchall()
    # 按题号顺序展开占位符，依次分配抠出的图
    slots = []
    for qid, number, stem, sub_json, options, answer_text in rows:
        keys = sorted(set(FIG_RE.findall((stem or "") + (sub_json or ""))), key=int)
        for k in keys:
            slots.append((qid, k))
    saved = 0
    pool = list(real)
    for qid, key in slots:
        if key in valid_keys(db, qid, BANK):
            continue
        row = db.execute("SELECT stem, subQuestions FROM questions WHERE qid=?",
                         (qid,)).fetchone()
        qtext = " ".join(question_texts({"stem": row[0], "subQuestions": row[1]}))
        chosen = None
        # 分批让视觉模型从剩余池中选最匹配的一张（一批最多8张）
        for start in range(0, len(pool), 8):
            batch = pool[start:start + 8]
            k = vision_pick(qtext, [p.read_bytes() for p in batch])
            if k >= 0:
                chosen = start + k
                break
        if chosen is None:
            print(f"  [warn] {pid}#{qid} fig{key} doc池无匹配图（剩池 {len(pool)}）",
                  file=sys.stderr)
            continue
        p = pool.pop(chosen)
        fname = f"{safe_name(qid)}_fig{key}{p.suffix}"
        ASSETS.mkdir(parents=True, exist_ok=True)
        (ASSETS / fname).write_bytes(p.read_bytes())
        db.execute(
            "INSERT OR REPLACE INTO figures(qid,figKey,label,page,imagePath,note,cropConfidence)"
            " VALUES(?,?,?,?,?,?,?)",
            (qid, key, None, f"doc:{p.name}", f"assets/{fname}",
             "doc内嵌图（视觉配对）", 0.75))
        saved += 1
    db.commit()
    return saved


def process_paper_docx(db, paper, groups_by_id):
    """纯文本 docx 卷：按图片锚点位置把内嵌图分配给题目。"""
    pid = paper["paperId"]
    gid = pick_best(paper["questionGroups"], groups_by_id)
    src = ROOT / gid
    docx_files = sorted(src.glob("*.docx")) if src.is_dir() else [src]
    if not docx_files:
        print(f"  [skip] {pid} 无 docx 文件", file=sys.stderr)
        return 0
    full_text, anchors, z = docx_media_with_anchors(docx_files[0])
    if not anchors:
        print(f"  [skip] {pid} docx 无内嵌图", file=sys.stderr)
        return 0

    rows = db.execute(
        "SELECT qid, number, stem, subQuestions, options, answerText FROM questions "
        "WHERE paperId=? AND (stem LIKE '%{{fig:%' OR subQuestions LIKE '%{{fig:%') "
        "ORDER BY CAST(number AS INT)", (pid,)).fetchall()
    if not rows:
        return 0

    norm_full, imap = norm_with_map(full_text)

    # 每题在原文中的起始偏移（归一化空间匹配，映射回原文偏移）
    raw_spans = []
    cursor = 0
    for qid, number, stem, sub_json, options, answer_text in rows:
        probe = FIG_RE.sub("", stem or "")
        probe = norm(probe)
        if not probe:
            continue
        # 前缀优先，失败则取中段（结构化模型可能改写开头）
        idx = -1
        for cand in (probe[:15], probe[10:25], probe[20:35]):
            if len(cand) < 6:
                continue
            idx = norm_full.find(cand, cursor)
            if idx < 0:
                idx = norm_full.find(cand)
            if idx >= 0:
                break
        if idx < 0:
            print(f"  [warn] {pid}#{number} 全文定位失败", file=sys.stderr)
            continue
        raw_off = imap[min(idx, len(imap) - 1)]
        raw_spans.append((raw_off, qid, stem, sub_json))
        cursor = idx + 1
    raw_spans.sort()
    if not raw_spans:
        return 0

    gid_hash = hashlib.md5(gid.encode()).hexdigest()[:10]
    media_dir = OCR_DIR / "docx_media_text" / gid_hash
    from PIL import Image

    saved = 0
    for i, (start, qid, stem, sub_json) in enumerate(raw_spans):
        end = raw_spans[i + 1][0] if i + 1 < len(raw_spans) else len(full_text)
        imgs = [(off, name) for off, name in anchors if start <= off < end]
        if not imgs:
            continue
        keys = sorted(set(FIG_RE.findall((stem or "") + (sub_json or ""))), key=int)
        if not keys:
            continue
        real_imgs = []
        for off, name in imgs:
            p = extract_media(z, name, media_dir)
            try:
                with Image.open(p) as im:
                    w, h = im.size
                if w >= 60 and h >= 40:  # 过滤公式碎片小图
                    real_imgs.append((off, name, p))
            except Exception:
                continue
        for key, item in zip(keys, real_imgs):
            if key in valid_keys(db, qid, BANK):
                continue
            off, name, p = item
            fname = f"{safe_name(qid)}_fig{key}{p.suffix}"
            ASSETS.mkdir(parents=True, exist_ok=True)
            (ASSETS / fname).write_bytes(p.read_bytes())
            db.execute(
                "INSERT OR REPLACE INTO figures(qid,figKey,label,page,imagePath,note,cropConfidence)"
                " VALUES(?,?,?,?,?,?,?)",
                (qid, key, None, f"docx:{name}", f"assets/{fname}",
                 "docx内嵌图（按文档位置配对）", 0.8))
            saved += 1
    db.commit()
    return saved


# ---------------------------------------------------------------- 主流程

def safe_name(s):
    return re.sub(r"[^\w一-鿿.-]", "_", s)


def box_confidence(box):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if w <= 0.01 or h <= 0.008:
        return 0.3
    if w * h > 0.85:
        return 0.4
    if w > 1.02 or h > 1.02 or x0 < -0.02 or y0 < -0.02:
        return 0.4
    return 0.95


def process_paper(db, paper, groups_by_id):
    pid = paper["paperId"]
    rows = db.execute(
        "SELECT qid, number, stem, subQuestions, options, answerText FROM questions "
        "WHERE paperId=?",
        (pid,)).fetchall()
    if not rows:
        return 0
    gid = pick_best(paper["questionGroups"], groups_by_id)
    if not gid:
        print(f"  [skip] {pid} 无来源组", file=sys.stderr)
        return 0
    channel, pages = group_pages(gid)
    if not pages:
        # 纯文本 Word 卷：docx 走内嵌图锚点通道，doc 走 OLE 抠图顺序通道
        if channel in ("docx", None):
            return process_paper_docx(db, paper, groups_by_id)
        if channel == "doc":
            return process_paper_doc_carve(db, paper, groups_by_id)
        print(f"  [skip] {pid} 通道 {channel} 无页面图", file=sys.stderr)
        return 0

    # 题目收集（页映射仅作参考；匹配靠全局标签+全卷视觉选图）
    all_qs = []  # [(q, sorted keys)]
    for qid, number, stem, sub_json, options, answer_text in rows:
        q = {"qid": qid, "number": number, "stem": stem, "subQuestions": sub_json,
             "options": options, "answerText": answer_text}
        page = map_question_page(q, pages)
        if not page:
            print(f"  [warn] {pid}#{number} 页映射失败（将走全卷选图）", file=sys.stderr)
        keys = set()
        for s in question_texts(q):
            keys |= set(FIG_RE.findall(s))
        keys -= valid_keys(db, qid, BANK)
        if keys:
            all_qs.append((q, keys, page))
    page_questions = {}  # 保留结构供后续遍历
    for q, keys, page in all_qs:
        page_questions.setdefault(page["key"] if page else "__none__",
                                 []).append((q, keys, page))

    # ---- 全卷预检：对来源组的全部页面做插图检测（带缓存），建全局 标签->(fig,page) 索引 ----
    from PIL import Image
    global_by_label = {}   # "16" / "21乙" -> (fig, page)
    global_by_qnum = {}    # "17"（第17题图）-> (fig, page)
    page_figs = {}         # page_key -> [fig,...]
    for page in pages:
        try:
            figs = detect_figures(page["image"], set())
        except Exception as e:
            print(f"  [fail] {pid} 页 {page['key']} 视觉定位失败: {e}", file=sys.stderr)
            figs = []
        page_figs[page["key"]] = figs
        for f in figs:
            lab = f.get("label", "") or ""
            nums = LABEL_RE.findall(lab)
            if nums and nums[0] not in global_by_label:
                global_by_label[nums[0]] = (f, page)
            # “第N题图”格式：直接按题号索引
            qm = QNUM_RE.search(lab)
            if qm and qm.group(1) not in global_by_qnum:
                global_by_qnum[qm.group(1)] = (f, page)

    def crop_of(fig, page):
        im = Image.open(page["image"])
        W, H = im.size
        pad_x, pad_y = 0.015, 0.012
        x0, y0, x1, y1 = fig["box"]
        x0, y0 = max(0.0, x0 - pad_x), max(0.0, y0 - pad_y)
        x1, y1 = min(1.0, x1 + pad_x), min(1.0, y1 + pad_y)
        return im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))

    saved = 0
    used_global = set()

    def extract_label(stems, key):
        for s in stems:
            m = re.search(r"\{\{fig:%s\}\}[^\n]{0,80}" % re.escape(key), s)
            if m:
                lm = LABEL_RE.search(m.group(0))
                if lm:
                    return lm.group(1)
        return None

    # 逐题分配：标签全局匹配 -> 全卷视觉兜底（顺序执行，API 密集无需并发）
    for q, keys, _mapped_page in [(q, keys, pg) for qlist in page_questions.values()
                                  for (q, keys, pg) in qlist]:
        stems = question_texts(q)
        for key in sorted(keys, key=int):
            fig = page = None
            label = extract_label(stems, key)
            if label and label in global_by_label:
                cand_fig, cand_page = global_by_label[label]
                if id(cand_fig) not in used_global:
                    fig, page = cand_fig, cand_page
            if fig is None and q["number"] in global_by_qnum:
                cand_fig, cand_page = global_by_qnum[q["number"]]
                if id(cand_fig) not in used_global:
                    fig, page = cand_fig, cand_page
            if fig is None:
                # 全卷未占用的候选，分批视觉选图
                pool = [(f, pg) for pg in pages
                        for f in page_figs.get(pg["key"], [])
                        if id(f) not in used_global]
                import io as _io
                for start in range(0, len(pool), 8):
                    batch = pool[start:start + 8]
                    crops = []
                    for f, pg in batch:
                        buf = _io.BytesIO()
                        crop_of(f, pg).save(buf, format="PNG")
                        crops.append(buf.getvalue())
                    k = vision_pick(" ".join(stems)[:600], crops)
                    if k >= 0:
                        fig, page = batch[k]
                        break
            if fig is None:
                print(f"  [warn] {pid}#{q['number']} fig{key} 无匹配插图", file=sys.stderr)
                continue
            used_global.add(id(fig))
            conf = box_confidence(fig["box"])
            if (fig["box"][2] - fig["box"][0]) < 0.08:
                conf = min(conf, 0.5)  # 过窄疑似截断
            crop = crop_of(fig, page)
            fname = f"{safe_name(q['qid'])}_fig{key}.png"
            ASSETS.mkdir(parents=True, exist_ok=True)
            crop.save(ASSETS / fname)
            db.execute(
                "INSERT OR REPLACE INTO figures(qid,figKey,label,page,imagePath,note,cropConfidence)"
                " VALUES(?,?,?,?,?,?,?)",
                (q["qid"], key, fig.get("label"), page["key"],
                 f"assets/{fname}", fig.get("desc", ""), conf))
            saved += 1
    db.commit()
    return saved


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--paper", default=None)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--build-watermarks", action="store_true",
                    help="先做跨文档水印分析（基于已抠出的 doc 图）")
    args = ap.parse_args()

    if args.build_watermarks:
        wm = build_watermark_set()
        print(f"水印库: {len(wm)} 个哈希", file=sys.stderr)

    inv, groups_by_id, papers_by_id = load_inventory()
    db = get_db()
    # Compare actual slot keys and files, never figure-count versus question-count.
    todo_set = set()
    for row in db.execute("SELECT qid,paperId,stem,options,subQuestions,answerText FROM questions"):
        q = dict(zip(("qid", "paperId", "stem", "options", "subQuestions", "answerText"), row))
        if slots(q) - valid_keys(db, q["qid"], BANK):
            todo_set.add(q["paperId"])
    todo = sorted(todo_set)
    if args.paper:
        todo = [pid for pid in todo if pid == args.paper]
    if args.limit:
        todo = todo[: args.limit]
    print(f"待补全 {len(todo)} 套卷", file=sys.stderr)
    total = 0
    for i, pid in enumerate(todo, 1):
        paper = papers_by_id.get(pid)
        if not paper:
            continue
        print(f"[{i}/{len(todo)}] {pid}", file=sys.stderr)
        try:
            total += process_paper(db, paper, groups_by_id)
        except Exception as e:
            print(f"  [FAIL] {pid}: {e}", file=sys.stderr)
    print(json.dumps({"figuresSaved": total}, ensure_ascii=False))


if __name__ == "__main__":
    main()
