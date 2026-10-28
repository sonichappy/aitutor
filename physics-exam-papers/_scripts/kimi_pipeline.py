#!/usr/bin/env python3
"""初中物理题库流水线（Kimi Work 独立执行，不依赖 aitutor 项目代码）。

子命令：
  ocr <groupId>            对一个试卷组做 OCR/文本提取，结果缓存到 _state/ocr/
  structure <paperId>      将试卷全文结构化为逐题 JSON，写入 question-bank/physics.db
  run <paperId>            ocr + structure 一条龙
  batch [--year-min N] [--year-max N] [--province P] [--with-answer-only] [--limit N]
                           批量跑（自动跳过已完成，断点续跑）
  stats                    输出题库统计
"""
import base64
import hashlib
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(os.environ.get('PHYSICS_ROOT', str(Path(__file__).resolve().parent.parent)))
STATE = ROOT / "_state"
OCR_DIR = STATE / "ocr"
BANK = ROOT / "question-bank"
DB_PATH = BANK / "physics.db"
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}

# Physical-bank pipeline always uses DeepSeek; load local settings for direct CLI runs.
import shlex
_config = Path(__file__).with_name("pipeline.env")
if _config.exists():
    for _line in _config.read_text().splitlines():
        _parts = shlex.split(_line, comments=True)
        if _parts and _parts[0] == "export":
            _parts = _parts[1:]
        if len(_parts) == 1 and "=" in _parts[0]:
            _key, _value = _parts[0].split("=", 1)
            if re.fullmatch(r"[A-Z][A-Z0-9_]*", _key):
                os.environ.setdefault(_key, _value)
_PROVIDER = os.environ.get("PIPELINE_PROVIDER", "deepseek")
if _PROVIDER != "deepseek":
    raise RuntimeError("物理题库流水线仅允许 DeepSeek；请设置 PIPELINE_PROVIDER=deepseek")
BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1").rstrip("/")
if not BASE_URL.endswith("/v1"):
    BASE_URL += "/v1"
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-flash")
OCR_WORKERS = int(os.environ.get("OCR_WORKERS", "4"))

# ---------------------------------------------------------------- 人教版章节树
CHAPTER_TREE = """
八年级上册：第一章 机械运动（长度和时间的测量/运动的描述/运动的快慢/测量平均速度）；
第二章 声现象（声音的产生与传播/声音的特性/声的利用/噪声的危害和控制）；
第三章 物态变化（温度/熔化和凝固/汽化和液化/升华和凝华）；
第四章 光现象（光的直线传播/光的反射/平面镜成像/光的折射/光的色散）；
第五章 透镜及其应用（透镜/生活中的透镜/凸透镜成像的规律/眼睛和眼镜/显微镜和望远镜）；
第六章 质量与密度（质量/密度/测量物质的密度/密度与社会生活）。
八年级下册：第七章 力（力/弹力/重力）；
第八章 运动和力（牛顿第一定律/二力平衡/摩擦力）；
第九章 压强（压强/液体的压强/大气压强/流体压强与流速的关系）；
第十章 浮力（浮力/阿基米德原理/物体的浮沉条件及应用）；
第十一章 功和机械能（功/功率/动能和势能/机械能及其转化）；
第十二章 简单机械（杠杆/滑轮/机械效率）。
九年级全一册：第十三章 内能（分子热运动/内能/比热容）；
第十四章 内能的利用（热机/热机的效率/能量的转化和守恒）；
第十五章 电流和电路（两种电荷/电流和电路/串联和并联/电流的测量/串、并联电路中电流的规律）；
第十六章 电压 电阻（电压/串、并联电路中电压的规律/电阻/变阻器）；
第十七章 欧姆定律（电流与电压和电阻的关系/欧姆定律/电阻的测量/欧姆定律在串、并联电路中的应用）；
第十八章 电功率（电能 电功/电功率/测量小灯泡的电功率/焦耳定律）；
第十九章 生活用电（家庭电路/家庭电路中电流过大的原因/安全用电）；
第二十章 电与磁（磁现象 磁场/电生磁/电磁铁 电磁继电器/电动机/磁生电）；
第二十一章 信息的传递；第二十二章 能源与可持续发展。
"""

QUESTION_TYPES = "single_choice(单选) / multiple_choice(多选) / fill_blank(填空) / drawing(作图) / experiment(实验探究) / calculation(计算) / short_answer(简答) / comprehensive(综合)"

# ---------------------------------------------------------------- OCR 提示词
OCR_PROMPT = """这是一页中国初中物理中考试卷的扫描件。请完整、逐字地将本页内容转录为 Markdown。

要求：
1. 保持题目编号原样（如"1．""15."、"（1）"等）。
2. 选择题选项用 A. B. C. D. 分行书写。
3. 物理公式、数值、单位用 LaTeX 行内公式 $...$ 表示，如 $v=\\frac{s}{t}$、$2\\times10^{3}\\ \\mathrm{kg/m^{3}}$。
4. 图片、图表、坐标图、电路图等无法转录的图形，在原位置插入占位符 [图N]（N 为本页内从 1 开始的编号），并用一句话简述图形内容，如 [图1：探究平面镜成像实验装置图]。
5. 忽略页眉页脚、水印（如"XX教育考试院""XX网"字样）、装订线、页码、考生须知表格之外的无关注释。
6. 不要添加任何解释、点评或额外内容，只输出转录的 Markdown 正文。"""

ANSWER_OCR_PROMPT = OCR_PROMPT.replace(
    "中考试卷的扫描件", "中考试卷【答案与解析】的扫描件"
).replace("6. 不要添加任何解释、点评或额外内容，只输出转录的 Markdown 正文。",
          "6. 保留题号与答案的对应关系。不要添加任何点评，只输出转录的 Markdown 正文。")

# ---------------------------------------------------------------- 结构化提示词
STRUCT_PROMPT = """你是一名初中物理教研员。下面是一套中考物理试卷的完整文本（由 OCR 转录，可能含少量识别错误），{answer_hint}请将其结构化为逐题 JSON。

## 题型定义
{types}

## 章节体系（人教版，分类只能从这里选）
{chapters}

## 输出 schema
输出一个 JSON 对象，键 "questions" 为数组，每题一个对象：
{{
  "number": "题号字符串，如 1、15、(1) 不需要；大题下有小题的，小题用小题号",
  "type": "上述8种题型之一",
  "score": 分值数字（从题干或卷面说明推断，无法推断给 null）,
  "stem": "题干 Markdown 文本。填空处用 {{{{blank:1}}}}、{{{{blank:2}}}} 占位；图形用 {{{{fig:1}}}} 占位（对应 OCR 文本中的 [图N]，保留其简述）",
  "options": [{{"label": "A", "text": "选项文本，可含 LaTeX", "hasFigure": false}}]，非选择题为空数组,
  "blanks": [{{"key": 1, "hint": "该空上下文简述，可为空字符串"}}]，无填空为空数组,
  "subQuestions": [递归同结构的对象数组，用于实验/计算大题的小题（1）（2）（3）；无小题为空数组],
  "chapters": [{{"grade": "八年级上册", "chapter": "第四章 光现象", "section": "光的反射"}}]，1-3 个，按相关度排序,
  "topics": ["考点短语，如 光的反射定律、凸透镜成像"], 1-4 个,
  "answer": {{
    "status": "official 或 missing",
    "choice": "选择题答案字母，多选用逗号分隔，非选择题为 null",
    "blanks": ["各空标准答案文本，按 blank key 顺序"],
    "text": "答案/解题过程 Markdown，可含 LaTeX",
    "analysis": "解析文字，试卷附了解析才填，否则为空字符串"
  }},
  "confidence": 0.0-1.0 你对本题结构化结果（含章节分类）的置信度
}}

## 规则
1. 逐题拆分，不得合并、遗漏；卷面说明、考生须知不是题目。
2. 题干中的图一律用 {{{{fig:N}}}} 占位并保留简述，不要试图描述成 ASCII 图。
3. 若文本里有答案（或我提供了答案文本），把每题答案填入 answer 并标 official；找不到答案的题标 missing，answer 其余字段留空/null。不要自己编造答案。
4. OCR 明显错误（如乱码字符）按物理常识修正；无法确定的保留原样。
5. 只输出 JSON，不要任何额外文字。
6. 若本卷为理综/科学/理化合卷，只结构化【物理】题目；化学、生物等其他学科的题整题跳过（题号保持卷面原样，不要重排）。判断依据：题目考查内容是否属于初中物理（声光热力电、能源等）。

## 试卷文本
{paper_text}
{answer_section}
"""

# ---------------------------------------------------------------- Kimi 网关调用

def chat(messages, max_tokens=8192, json_mode=False, retries=3, effort=None):
    if not API_KEY:
        raise RuntimeError("缺少 DEEPSEEK_API_KEY")
    payload = {"model": MODEL, "messages": messages, "max_tokens": max_tokens}
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    if effort:
        payload["reasoning_effort"] = effort
    for attempt in range(retries):
        try:
            r = requests.post(
                f"{BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json=payload, timeout=300,
            )
            if r.status_code == 400:
                print(f"  [400 body] {r.text[:300]}", file=sys.stderr)
            if r.status_code == 400 and json_mode:
                # 网关可能不支持 json mode，降级
                return chat(messages, max_tokens=max_tokens, json_mode=False, retries=retries)
            if r.status_code in (401, 403):
                # 密钥失效/无权限：重试无意义，立即失败（避免每请求白等 60s 退避）
                raise RuntimeError(
                    f"HTTP {r.status_code} Unauthorized: 请检查 {_PROVIDER} 的 API Key")
            if r.status_code in (429, 500, 502, 503, 504):
                wait = 10 * (attempt + 1)
                print(f"  [retry] HTTP {r.status_code}, {wait}s 后重试", file=sys.stderr)
                time.sleep(wait)
                continue
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"], data.get("usage", {})
        except requests.RequestException as e:
            if attempt == retries - 1:
                raise
            wait = 10 * (attempt + 1)
            print(f"  [retry] {e}, {wait}s 后重试", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("chat() retries exhausted")


def ocr_image(image_path):
    b64 = base64.b64encode(Path(image_path).read_bytes()).decode()
    suffix = Path(image_path).suffix.lower().lstrip(".")
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "webp": "image/webp", "gif": "image/gif", "bmp": "image/bmp"}.get(suffix, "image/png")
    prompt = ANSWER_OCR_PROMPT if is_answer_name(str(image_path)) else OCR_PROMPT
    return chat([{"role": "user", "content": [
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
    ]}], max_tokens=8192)


def is_answer_name(name):
    return bool(re.search(r"答案|解析", Path(name).stem))


# ---------------------------------------------------------------- 文本提取（免 OCR 通道）

def extract_docx_images(path, out_dir):
    """docx 内嵌图片按文档顺序导出（用于图片型 docx 走 OCR）。"""
    import zipfile
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    z = zipfile.ZipFile(str(path))
    doc_xml = z.read("word/document.xml").decode("utf-8", errors="replace")
    rels_xml = z.read("word/_rels/document.xml.rels").decode("utf-8", errors="replace")
    rid2target = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels_xml))
    order = re.findall(r'r:embed="([^"]+)"', doc_xml)
    seen, paths = set(), []
    for rid in order:
        if rid in seen or rid not in rid2target:
            continue
        seen.add(rid)
        target = rid2target[rid]
        name = target.split("/")[-1]
        try:
            data = z.read(f"word/media/{name}")
        except KeyError:
            continue
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else "png"
        p = out_dir / f"img{len(paths)+1:02d}.{ext}"
        p.write_bytes(data)
        paths.append(p)
    return paths


def ocr_images_cached(image_paths, cache_dir):
    """对一组图片 OCR，逐页缓存，4 并发。返回按顺序的文本列表。"""
    cache_dir = Path(cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)
    cached, todo = {}, []
    for f in image_paths:
        f = Path(f)
        cc = cache_dir / (f.stem + ".md")
        if cc.exists():
            cached[f.stem] = cc.read_text(encoding="utf-8")
        else:
            todo.append(f)
    if todo:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        with ThreadPoolExecutor(max_workers=OCR_WORKERS) as ex:
            futs = {ex.submit(ocr_image, f): f for f in todo}
            for fut in as_completed(futs):
                f = futs[fut]
                text = fut.result()[0]
                (cache_dir / (f.stem + ".md")).write_text(text, encoding="utf-8")
                cached[f.stem] = text
                print(f"  OCR {f.name} 完成", file=sys.stderr)
    return [cached[Path(f).stem] for f in image_paths]


def extract_docx(path):
    import docx
    d = docx.Document(str(path))
    return "\n".join(p.text for p in d.paragraphs if p.text.strip())


def extract_doc(path):
    """macOS textutil 转换老 .doc 提取文本"""
    out = subprocess.run(
        ["textutil", "-convert", "txt", "-stdout", str(path)],
        capture_output=True, timeout=60,
    )
    if out.returncode == 0:
        return out.stdout.decode("utf-8", errors="replace")
    raise RuntimeError(f"textutil 转换失败: {path}")


def extract_doc_binary(path):
    """解析 .doc 的 piece table 提取正文（处理 textutil 失败的复杂/快速存盘文档）。

    依据 MS-DOC：FIB(0x01A2)=fcClx, FIB(0x01A6)=lcbClx；Clx 中 0x02 标记 Pcdt，
    其后是 (n+1) 个 CP + n 个 PCD(8字节)；PCD.fc 位30 置位表示 8-bit 压缩文本
    （实际偏移 fc/2），否则 UTF-16LE。
    """
    import struct

    import olefile
    ole = olefile.OleFileIO(str(path))
    wd = ole.openstream("WordDocument").read()
    flags = struct.unpack_from("<H", wd, 0x0A)[0]
    table_name = "1Table" if (flags & 0x0200) else "0Table"
    if not ole.exists(table_name):
        table_name = "1Table" if ole.exists("1Table") else "0Table"
    tbl = ole.openstream(table_name).read()
    fcClx, lcbClx = struct.unpack_from("<II", wd, 0x01A2)
    clx = tbl[fcClx : fcClx + lcbClx]
    pos = 0
    while pos < len(clx) and clx[pos] == 0x01:  # 跳过 Prc
        cb = struct.unpack_from("<H", clx, pos + 1)[0]
        pos += 3 + cb
    if pos >= len(clx) or clx[pos] != 0x02:
        raise RuntimeError("piece table 未找到")
    lcb = struct.unpack_from("<I", clx, pos + 1)[0]
    pcdt = clx[pos + 5 : pos + 5 + lcb]
    n = (len(pcdt) - 4) // 12
    cps = struct.unpack_from(f"<{n+1}I", pcdt, 0)
    parts = []
    for i in range(n):
        pcd_off = 4 * (n + 1) + i * 8
        fc_raw = struct.unpack_from("<I", pcdt, pcd_off + 2)[0]
        nchars = cps[i + 1] - cps[i]
        if fc_raw & 0x40000000:
            off = (fc_raw & 0x3FFFFFFF) // 2
            raw = wd[off : off + nchars]
            parts.append(raw.decode("gb18030", errors="ignore"))
        else:
            off = fc_raw & 0x3FFFFFFF
            raw = wd[off : off + nchars * 2]
            parts.append(raw.decode("utf-16le", errors="ignore"))
    text = "".join(parts)
    # 清理 Word 控制字符
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    text = text.replace("\r", "\n").replace("\x07", "\t")
    return text


def carve_doc_images(path, out_dir, min_bytes=20000, min_dim=400):
    """从 .doc 二进制中按 JPEG/PNG 魔数抠出嵌入图片（终极兜底）。"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = Path(path).read_bytes()
    spans = []
    for m in re.finditer(b"\xff\xd8\xff", data):
        s = m.start()
        e = data.find(b"\xff\xd9", s)
        if e > 0 and e - s > min_bytes:
            spans.append((s, e + 2, ".jpg"))
    for m in re.finditer(b"\x89PNG\r\n\x1a\n", data):
        s = m.start()
        e = data.find(b"IEND\xaeB`\x82", s)
        if e > 0 and e - s > min_bytes:
            spans.append((s, e + 8, ".png"))
    spans.sort()
    paths = []
    try:
        from PIL import Image
    except ImportError:
        Image = None
    for s, e, ext in spans:
        p = out_dir / f"carve{len(paths)+1:02d}{ext}"
        p.write_bytes(data[s:e])
        if Image:
            try:
                with Image.open(p) as im:
                    im.verify()
                with Image.open(p) as im:
                    w, h = im.size
                if w < min_dim or h < min_dim:
                    p.unlink()
                    continue
            except Exception:
                p.unlink()
                continue
        paths.append(p)
    return paths


def doc_to_images(path, out_dir):
    """.doc 文本过少时：textutil 转 docx 后抽内嵌图片走 OCR。"""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    docx_path = out_dir / (Path(path).stem + ".docx")
    if not docx_path.exists():
        out = subprocess.run(
            ["textutil", "-convert", "docx", "-output", str(docx_path), str(path)],
            capture_output=True, timeout=120,
        )
        if out.returncode != 0 or not docx_path.exists():
            raise RuntimeError(f"textutil doc->docx 转换失败: {path}")
    return extract_docx_images(docx_path, out_dir / "media")


def extract_pdf_text(path):
    import pdfplumber
    parts = []
    with pdfplumber.open(str(path)) as pdf:
        for pg in pdf.pages:
            t = pg.extract_text() or ""
            parts.append(t)
    return "\n".join(parts)


def pdf_to_images(path, out_dir):
    """PDF 无文字层时渲染为图片走 OCR。"""
    import pypdfium2 as pdfium
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    doc = pdfium.PdfDocument(str(path))
    paths = []
    for i in range(len(doc)):
        img = doc[i].render(scale=2.0).to_pil()
        p = out_dir / f"page{i+1:02d}.png"
        img.save(p)
        paths.append(p)
    doc.close()
    return paths


# ---------------------------------------------------------------- 组级 OCR/提取（带缓存）

def group_dir(group_id):
    return ROOT / group_id


def ocr_cache_path(group_id):
    safe = hashlib.md5(group_id.encode()).hexdigest()[:10]
    return OCR_DIR / f"{safe}.json"


def ocr_group(group_id, force=False):
    """对一个组做文本提取/OCR，返回 {pages: [str], source: str}。结果缓存。"""
    cache = ocr_cache_path(group_id)
    if cache.exists() and not force:
        return json.loads(cache.read_text(encoding="utf-8"))

    src = group_dir(group_id)
    if not src.exists():
        raise FileNotFoundError(group_id)

    if src.is_file():
        files = [src]
    else:
        files = sorted(f for f in src.iterdir() if f.is_file() and not f.name.startswith("."))

    exts = {f.suffix.lower() for f in files}
    pages, source = [], ""

    if exts & {".docx"}:
        source = "docx"
        gid_hash = hashlib.md5(group_id.encode()).hexdigest()[:10]
        for f in files:
            if f.suffix.lower() == ".docx":
                text = extract_docx(f)
                if len(text.strip()) < 200:
                    # 图片型 docx：抽出内嵌图片走 OCR
                    media_dir = OCR_DIR / "docx_media" / gid_hash / f.stem
                    imgs = extract_docx_images(f, media_dir)
                    if imgs:
                        source = "docx-images"
                        pages.extend(ocr_images_cached(
                            imgs, OCR_DIR / "pages" / gid_hash / f.stem))
                        continue
                pages.append(text)
    elif exts & {".doc"}:
        source = "doc"
        gid_hash = hashlib.md5(group_id.encode()).hexdigest()[:10]
        for f in files:
            if f.suffix.lower() == ".doc":
                text = extract_doc(f)
                if len(text.strip()) < 200:
                    imgs = doc_to_images(f, OCR_DIR / "doc_media" / gid_hash / f.stem)
                    if not imgs:
                        imgs = carve_doc_images(
                            f, OCR_DIR / "doc_carve" / gid_hash / f.stem)
                    if imgs:
                        source = "doc-images"
                        pages.extend(ocr_images_cached(
                            imgs, OCR_DIR / "pages" / gid_hash / f.stem))
                        continue
                pages.append(text)
    elif exts & {".pdf"}:
        pdf_files = [f for f in files if f.suffix.lower() == ".pdf"]
        text = extract_pdf_text(pdf_files[0])
        if len(text.strip()) > 200:
            source = "pdf-text"
            pages = [text]
        else:
            source = "pdf-scan"
            gid_hash = hashlib.md5(group_id.encode()).hexdigest()[:10]
            img_dir = OCR_DIR / "rendered" / gid_hash
            imgs = pdf_to_images(pdf_files[0], img_dir)
            pages = ocr_images_cached(imgs, OCR_DIR / "pages" / gid_hash)
    elif exts & IMG_EXT:
        source = "images"
        gid_hash = hashlib.md5(group_id.encode()).hexdigest()[:10]
        imgs = [f for f in files if f.suffix.lower() in IMG_EXT]
        pages = ocr_images_cached(imgs, OCR_DIR / "pages" / gid_hash)
    elif exts & {".zip", ".rar", ".7z"}:
        raise RuntimeError(f"未解压的压缩包组，跳过: {group_id}")
    else:
        raise RuntimeError(f"无法识别的组格式: {group_id} {exts}")

    result = {"groupId": group_id, "source": source, "pages": pages,
              "ocrAt": datetime.now(timezone.utc).isoformat()}
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    return result


# ---------------------------------------------------------------- 来源选择

FMT_RANK = {"word": 0, "docx": 0, "doc": 0, "pdf-text": 1, "pdf": 1,
            "mixed": 2, "images": 3, "pdf-scan": 4, "archive": 9, "other": 9, "empty": 9}


def pick_best(group_ids, groups_by_id):
    """同一试卷多个来源组时选最优：格式优先（word > pdf > 图片），同格式取页数最多的。"""
    cands = []
    for gid in group_ids:
        g = groups_by_id.get(gid)
        if g:
            cands.append((FMT_RANK.get(g["format"], 5), -g["nFiles"], gid))
    if not cands:
        return None
    cands.sort()
    return cands[0][2]


# ---------------------------------------------------------------- 结构化

def extract_json(text):
    """从模型输出中提取 JSON（容忍 ```json 包裹或前后杂文本）。"""
    text = text.strip()
    m = re.search(r"```(?:json)?\s*(\{.*\}|\[.*\])\s*```", text, re.DOTALL)
    if m:
        text = m.group(1)
    else:
        start = min([i for i in (text.find("{"), text.find("[")) if i >= 0], default=-1)
        if start >= 0:
            # 找匹配的结尾
            text = text[start:]
            for end in range(len(text) - 1, -1, -1):
                if text[end] in "}]":
                    text = text[: end + 1]
                    break
    return json.loads(text)


PLAN_PROMPT = """下面是一套中考物理试卷的完整文本（OCR 转录）。请列出卷面所有【顶层大题/小题】的题号（不要列出大题内部的（1）（2）小问），按出现顺序输出 JSON：
{{"numbers": ["1","2","3"]}}
只输出 JSON。

## 试卷文本
{paper_text}
"""

STRUCT_CHUNK_PROMPT = STRUCT_PROMPT.replace(
    "请将其结构化为逐题 JSON。",
    "请只把以下题号结构化为逐题 JSON：{only_numbers}（其余题号忽略）。",
)


def structure_cache_path(paper_id):
    d = OCR_DIR / "structure"
    d.mkdir(parents=True, exist_ok=True)
    return d / (hashlib.md5(paper_id.encode()).hexdigest()[:10] + ".json")


def structure_chunk_cache_path(paper_id, idx):
    d = OCR_DIR / "structure_chunks" / hashlib.md5(paper_id.encode()).hexdigest()[:10]
    d.mkdir(parents=True, exist_ok=True)
    return d / f"chunk{idx:02d}.json"


def structure_paper(paper, groups_by_id, use_answer=True):
    """OCR（取缓存）+ 分块结构化，返回 questions 列表。"""
    scache = structure_cache_path(paper["paperId"])
    if scache.exists():
        data = json.loads(scache.read_text(encoding="utf-8"))
        return data["questions"], data["meta"]

    q_gid = pick_best(paper["questionGroups"], groups_by_id)
    if not q_gid:
        raise RuntimeError("无可用试题来源组")
    q_data = ocr_group(q_gid)
    paper_text = "\n\n".join(
        f"<!-- 第{i+1}页 -->\n{p}" for i, p in enumerate(q_data["pages"])
    )

    # 内容守卫：题号标记过少说明来源不是试卷正文（如试卷分析文章），快速失败
    n_markers = len(re.findall(r"(?:^|\n)\s*\d{1,2}\s*[．．.、]", paper_text))
    if n_markers < 5:
        raise RuntimeError(
            f"来源文本疑似非试卷正文（仅 {n_markers} 个题号标记）: {q_gid}")

    answer_text = ""
    answer_hint = "并附带了官方答案文本，"
    if use_answer and paper["answerGroups"]:
        # 拼接所有答案组（按优先级排序），最大化题号覆盖
        gids = sorted(
            (g for g in paper["answerGroups"] if g in groups_by_id),
            key=lambda g: (FMT_RANK.get(groups_by_id[g]["format"], 5),
                           -groups_by_id[g]["nFiles"]),
        )
        parts, total = [], 0
        for a_gid in gids:
            try:
                a_data = ocr_group(a_gid)
                t = "\n\n".join(a_data["pages"])
            except Exception as e:
                print(f"  [warn] 答案组提取失败 {a_gid}: {e}", file=sys.stderr)
                continue
            if total + len(t) > 40000:
                break
            parts.append(f"=== 答案来源: {a_gid.split('/')[-1]} ===\n{t}")
            total += len(t)
        answer_text = "\n\n".join(parts)
    if answer_text:
        answer_section = f"\n## 官方答案文本\n{answer_text}\n"
    else:
        answer_hint = "未附带答案文本，"
        answer_section = ""

    paper_text_trunc = paper_text[:60000]  # 超长截断保护

    # 第一步：规划题号清单
    # max_tokens 需给推理模型留足余量：reasoning 可能吃掉数千 token，
    # 2048 上限会导致 content 为空或 JSON 截断（deepseek-flash 实测踩过）。
    # 规划输出偶有截断/非法 JSON，重试 3 次
    numbers, plan_usage = None, None
    for attempt in range(3):
        plan_content, plan_usage = chat(
            [{"role": "user", "content": PLAN_PROMPT.format(paper_text=paper_text_trunc)}],
            max_tokens=8192, json_mode=True,
        )
        try:
            numbers = [str(n) for n in extract_json(plan_content)["numbers"]]
            break
        except (ValueError, KeyError) as e:
            print(f"  [retry] 规划第{attempt + 1}次输出解析失败: {e}", file=sys.stderr)
    if numbers is None:
        raise RuntimeError("规划题号清单失败（3 次尝试均无法解析 JSON）")
    print(f"  规划到 {len(numbers)} 个顶层题号: {','.join(numbers[:40])}", file=sys.stderr)

    # 第二步：按题号分块结构化（每块最多 8 题，逐块缓存可断点续跑，块间并行）
    questions_map, usages = {}, [plan_usage]
    chunk_size = 8
    chunks = [(ci // chunk_size, numbers[ci : ci + chunk_size])
              for ci in range(0, len(numbers), chunk_size)]

    def do_chunk(idx, chunk_nums):
        ccache = structure_chunk_cache_path(paper["paperId"], idx)
        if ccache.exists():
            return idx, json.loads(ccache.read_text(encoding="utf-8")), None
        prompt = STRUCT_CHUNK_PROMPT.format(
            types=QUESTION_TYPES, chapters=CHAPTER_TREE,
            paper_text=paper_text_trunc,
            answer_section=answer_section, answer_hint=answer_hint,
            only_numbers="、".join(chunk_nums),
        )
        # 模型输出偶有 JSON 截断/缺逗号，重试 3 次（成功一次即落盘缓存）
        last_err = None
        for attempt in range(3):
            try:
                content, usage = chat(
                    [{"role": "user", "content": prompt}],
                    max_tokens=32768, json_mode=True,
                )
                data = extract_json(content)
                chunk_qs = data["questions"] if isinstance(data, dict) else data
                ccache.write_text(json.dumps(chunk_qs, ensure_ascii=False), encoding="utf-8")
                return idx, chunk_qs, usage
            except (ValueError, KeyError) as e:  # JSONDecodeError 是 ValueError 子类
                last_err = e
                print(f"  [retry] 块{idx} 第{attempt + 1}次输出解析失败: {e}",
                      file=sys.stderr)
        raise RuntimeError(f"块{idx} 结构化失败（3 次尝试）: {last_err}")

    pending = [(idx, nums) for idx, nums in chunks
               if not structure_chunk_cache_path(paper["paperId"], idx).exists()]
    done_chunks = [(idx, nums) for idx, nums in chunks
                   if structure_chunk_cache_path(paper["paperId"], idx).exists()]
    for idx, _ in done_chunks:
        ccache = structure_chunk_cache_path(paper["paperId"], idx)
        questions_map[idx] = json.loads(ccache.read_text(encoding="utf-8"))
    if pending:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        with ThreadPoolExecutor(max_workers=3) as ex:
            futs = {ex.submit(do_chunk, idx, nums): idx for idx, nums in pending}
            for fut in as_completed(futs):
                idx, chunk_qs, usage = fut.result()
                questions_map[idx] = chunk_qs
                if usage:
                    usages.append(usage)
                print(f"  块{idx}: {len(chunk_qs)} 题", file=sys.stderr)
    questions = []
    for idx in sorted(questions_map):
        questions.extend(questions_map[idx])

    meta = {"questionGroup": q_gid, "usage": usages}
    scache.write_text(json.dumps({"questions": questions, "meta": meta},
                                 ensure_ascii=False), encoding="utf-8")
    return questions, meta


# ---------------------------------------------------------------- SQLite

SCHEMA = """
CREATE TABLE IF NOT EXISTS papers(
  paperId TEXT PRIMARY KEY,
  province TEXT, city TEXT, year INTEGER, stem TEXT,
  hasAnswer INTEGER, questionGroup TEXT, answerGroups TEXT,
  nQuestions INTEGER, status TEXT, createdAt TEXT
);
CREATE TABLE IF NOT EXISTS questions(
  qid TEXT PRIMARY KEY,
  paperId TEXT, number TEXT, type TEXT,
  stem TEXT, options TEXT, blanks TEXT, subQuestions TEXT,
  answerStatus TEXT, answerChoice TEXT, answerBlanks TEXT, answerText TEXT, analysis TEXT,
  chapters TEXT, topics TEXT,
  score REAL, confidence REAL, contentHash TEXT, createdAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_q_paper ON questions(paperId);
CREATE INDEX IF NOT EXISTS idx_q_type ON questions(type);
"""


def get_db():
    BANK.mkdir(exist_ok=True)
    db = sqlite3.connect(DB_PATH, check_same_thread=False)
    db.executescript(SCHEMA)
    return db


def norm_blanks(obj):
    """把 {{blank:N}}/{{fig:N}} 占位统一（模型可能输出 [图N] 残留，保留即可）。"""
    return obj


def norm_choice(s):
    """选择题答案归一化：提取 A-E 字母、大写、去重排序，消除 'A、C' vs 'AC' 类格式差异。

    无字母可提取时原样返回去空白后的字符串。
    """
    if not s:
        return s
    letters = re.findall(r"[A-E]", str(s).upper())
    if not letters:
        return str(s).strip()
    return "".join(sorted(set(letters)))


def save_paper(db, paper, questions, meta):
    now = datetime.now(timezone.utc).isoformat()
    has_answer = any(
        (q.get("answer") or {}).get("status") == "official" for q in questions
    )
    db.execute(
        "INSERT OR REPLACE INTO papers VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (paper["paperId"], paper["province"], paper["city"], paper["year"],
         paper["stem"], int(has_answer), meta.get("questionGroup"),
         json.dumps(paper["answerGroups"], ensure_ascii=False),
         len(questions), "done", now),
    )
    db.execute("DELETE FROM questions WHERE paperId=?", (paper["paperId"],))
    for q in questions:
        number = str(q.get("number", ""))
        qid = f"{paper['paperId']}#{number}"
        ans = q.get("answer") or {}
        body = json.dumps({k: q.get(k) for k in ("stem", "options", "subQuestions")},
                          ensure_ascii=False, sort_keys=True)
        ch = hashlib.sha1(body.encode()).hexdigest()[:16]
        db.execute(
            "INSERT OR REPLACE INTO questions("
            "qid,paperId,number,type,stem,options,blanks,subQuestions,"
            "answerStatus,answerChoice,answerBlanks,answerText,analysis,"
            "chapters,topics,score,confidence,contentHash,createdAt"
            ") VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (qid, paper["paperId"], number, q.get("type"),
             q.get("stem"), json.dumps(q.get("options") or [], ensure_ascii=False),
             json.dumps(q.get("blanks") or [], ensure_ascii=False),
             json.dumps(q.get("subQuestions") or [], ensure_ascii=False),
             ans.get("status", "missing"),
             norm_choice(ans.get("choice")), json.dumps(ans.get("blanks") or [], ensure_ascii=False),
             ans.get("text"), ans.get("analysis"),
             json.dumps(q.get("chapters") or [], ensure_ascii=False),
             json.dumps(q.get("topics") or [], ensure_ascii=False),
             q.get("score"), q.get("confidence"), ch, now),
        )
    db.commit()


# ---------------------------------------------------------------- 批跑状态

def batch_state_path():
    return STATE / "pipeline_done.json"


def load_done():
    p = batch_state_path()
    return set(json.loads(p.read_text())) if p.exists() else set()


def mark_done(paper_id):
    done = load_done()
    done.add(paper_id)
    batch_state_path().write_text(json.dumps(sorted(done), ensure_ascii=False))


# ---------------------------------------------------------------- CLI

def load_inventory():
    inv = json.loads((STATE / "inventory.json").read_text(encoding="utf-8"))
    groups_by_id = {g["groupId"]: g for g in inv["groups"]}
    papers_by_id = {p["paperId"]: p for p in inv["papers"]}
    return inv, groups_by_id, papers_by_id


def cmd_ocr(group_id):
    res = ocr_group(group_id)
    print(json.dumps({"groupId": group_id, "source": res["source"],
                      "pages": len(res["pages"]),
                      "chars": sum(len(p) for p in res["pages"])}, ensure_ascii=False))


def cmd_structure(paper_id, run_ocr=True):
    inv, groups_by_id, papers_by_id = load_inventory()
    paper = papers_by_id[paper_id]
    questions, meta = structure_paper(paper, groups_by_id)
    db = get_db()
    save_paper(db, paper, questions, meta)
    mark_done(paper_id)
    print(json.dumps({"paperId": paper_id, "nQuestions": len(questions),
                      "usage": meta.get("usage")}, ensure_ascii=False))


def cmd_batch(args):
    import threading
    inv, groups_by_id, papers_by_id = load_inventory()
    done = load_done()
    papers = inv["papers"]
    if args.year_min:
        papers = [p for p in papers if p["year"] and p["year"] >= args.year_min]
    if args.year_max:
        papers = [p for p in papers if p["year"] and p["year"] <= args.year_max]
    if args.province:
        papers = [p for p in papers if p["province"] == args.province]
    if args.with_answer_only:
        papers = [p for p in papers if p["hasAnswer"]]
    papers = [p for p in papers if p["questionGroups"] and p["paperId"] not in done]
    if args.ids:
        wanted = set(x.strip() for x in args.ids.split(",") if x.strip())
        papers = [p for p in papers if p["paperId"] in wanted]
    # 成本优先排序：最优来源格式（word/pdf文字层免OCR 在前），同年份新的在前
    def cost_key(p):
        gid = pick_best(p["questionGroups"], groups_by_id)
        g = groups_by_id.get(gid) if gid else None
        return (FMT_RANK.get(g["format"], 5) if g else 9, -(p["year"] or 0))
    papers.sort(key=cost_key)
    if args.limit:
        papers = papers[: args.limit]
    print(f"待处理 {len(papers)} 套（并发 {args.workers}）", file=sys.stderr)
    db = get_db()
    save_lock = threading.Lock()
    ok, fail = 0, []

    def process(idx_paper):
        i, paper = idx_paper
        pid = paper["paperId"]
        print(f"[{i}/{len(papers)}] {pid}", file=sys.stderr)
        questions, meta = structure_paper(paper, groups_by_id)
        with save_lock:
            save_paper(db, paper, questions, meta)
            mark_done(pid)
        return pid, len(questions)

    from concurrent.futures import ThreadPoolExecutor, as_completed
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process, (i, p)): p for i, p in enumerate(papers, 1)}
        for fut in as_completed(futs):
            p = futs[fut]
            try:
                pid, n = fut.result()
                ok += 1
                print(f"  -> {pid} {n} 题 (累计 {ok})", file=sys.stderr)
            except Exception as e:
                fail.append({"paperId": p["paperId"], "error": str(e)})
                print(f"  [FAIL] {p['paperId']}: {e}", file=sys.stderr)
    (STATE / "pipeline_failures.json").write_text(
        json.dumps(fail, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({"ok": ok, "fail": len(fail)}, ensure_ascii=False))
    if fail:
        raise SystemExit(1)


def cmd_stats():
    db = get_db()
    row = db.execute("SELECT COUNT(*), SUM(hasAnswer) FROM papers").fetchone()
    q = db.execute("SELECT COUNT(*) FROM questions").fetchone()[0]
    by_type = db.execute(
        "SELECT type, COUNT(*) FROM questions GROUP BY type ORDER BY 2 DESC").fetchall()
    by_year = db.execute(
        "SELECT year, COUNT(*) FROM questions GROUP BY year").fetchall() if False else \
        db.execute("SELECT p.year, COUNT(*) FROM questions q JOIN papers p ON q.paperId=p.paperId "
                   "GROUP BY p.year ORDER BY 1").fetchall()
    ans = db.execute("SELECT answerStatus, COUNT(*) FROM questions GROUP BY 1").fetchall()
    print(json.dumps({
        "papers": row[0] or 0, "papersWithAnswer": row[1] or 0, "questions": q,
        "byType": dict(by_type), "byYear": {str(k): v for k, v in by_year},
        "byAnswerStatus": dict(ans),
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("ocr"); p.add_argument("group_id")
    p = sub.add_parser("structure"); p.add_argument("paper_id")
    p = sub.add_parser("run"); p.add_argument("paper_id")
    p = sub.add_parser("batch")
    p.add_argument("--year-min", type=int, default=None)
    p.add_argument("--year-max", type=int, default=None)
    p.add_argument("--province", default=None)
    p.add_argument("--with-answer-only", action="store_true")
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--ids", default=None,
                   help="逗号分隔的 paperId 清单，只处理这些（仍跳过已完成）")
    p.add_argument("--workers", type=int, default=3)
    sub.add_parser("stats")
    args = ap.parse_args()
    if args.cmd == "ocr":
        cmd_ocr(args.group_id)
    elif args.cmd in ("structure", "run"):
        cmd_structure(args.paper_id)
    elif args.cmd == "batch":
        cmd_batch(args)
    elif args.cmd == "stats":
        cmd_stats()
