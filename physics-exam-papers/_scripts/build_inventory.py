#!/usr/bin/env python3
"""扫描 physics-exam-papers/ 试卷库，生成 _state/inventory.json。

输出两个层级：
- groups: 每个物理目录/散装文件一组（图片版/解压版/散装文件）
- papers: 按"年份+归一化标题"配对后的试卷，含 hasAnswer 判定与最佳来源选择
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "_state"

IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
DOC_EXT = {".doc", ".docx"}
PDF_EXT = {".pdf"}
ARCH_EXT = {".zip", ".rar", ".7z"}

SKIP_TOP = {"_待核验", "_复习资料", "_scripts", "_state", "question-bank"}

# 归一化标题时去除的标记
STRIP_PAT = re.compile(
    r"[_（(\s]*(图片版|下载版|已发布|已公布|公布|发布|附件\d*|解压|扫描版|清晰版|word版|无答案|含答案|附答案|及答案|带答案|有答案|参考答案|答案解析|答案|解析|试题|真题|试卷|物理|中考|年|省|市|卷)[_）)\s]*",
    re.IGNORECASE,
)

NON_PAPER_PAT = re.compile(r"(简评|评析|解读|点评|分析|复习|模拟|练习|专题|知识|讲义|课件|教案|说题|备考|已上线|上线|汇总|精选|培优|精练|押题|猜题|视频|出炉|网校|难度变化|独家发布)")


def classify_group_files(files):
    """根据文件列表判断组的格式类型。"""
    exts = {f.suffix.lower() for f in files}
    exts -= {".ds_store", ".txt"}  # txt 多为说明
    if not exts:
        return "empty", 0
    has_img = bool(exts & IMG_EXT)
    has_doc = bool(exts & DOC_EXT)
    has_pdf = bool(exts & PDF_EXT)
    has_arch = bool(exts & ARCH_EXT)
    n = sum(1 for f in files if f.suffix.lower() in (IMG_EXT | DOC_EXT | PDF_EXT | ARCH_EXT))
    kinds = sum([has_img, has_doc, has_pdf])
    if has_arch and kinds == 0:
        return "archive", n
    if kinds > 1:
        return "mixed", n
    if has_img:
        return "images", n
    if has_doc:
        return "word", n
    if has_pdf:
        return "pdf", n
    return "other", n


def group_kind(name):
    """判断组是试题、答案、试题+答案、还是非试卷内容。"""
    if NON_PAPER_PAT.search(name):
        return "non-paper"
    has_answer = bool(re.search(r"答案|解析", name))
    has_paper = bool(re.search(r"试题|真题|试卷|考题|学业考试|招生考试|中考", name))
    both = bool(re.search(r"及答案|含答案|附答案|带答案|有答案", name))
    if both:
        return "both"
    if has_answer and has_paper:
        # "试题答案"型
        return "answer" if re.search(r"(试题|真题|试卷)答案", name) else "both"
    if has_answer:
        return "answer"
    if has_paper:
        return "question"
    return "unknown"


def normalize_stem(name):
    """去除标记词后得到配对用主干。"""
    s = Path(name).stem
    s = re.sub(r"_图片版$|_解压$", "", s)
    s = STRIP_PAT.sub("", s)
    s = re.sub(r"[\s_（）()：:，,。.、\-—]+", "", s)
    return s.lower()


def extract_city(name, province):
    if province == "北京":
        return "北京"
    m = re.search(r"年([^年省]{1,8}?)(?:市)?中考", name)
    if m:
        city = m.group(1)
        for junk in ("省", "市", "自治区"):
            city = city.replace(junk, "")
        return city or province
    return province


def extract_year(name, path_year):
    m = re.search(r"(20\d{2})年?", name)
    if m:
        return int(m.group(1))
    try:
        return int(path_year)
    except (ValueError, TypeError):
        return None


def scan_groups():
    groups = []
    for region_dir in sorted(ROOT.iterdir()):
        if not region_dir.is_dir() or region_dir.name in SKIP_TOP:
            continue
        if region_dir.name == "北京":
            provinces = [("北京", region_dir)]
        elif region_dir.name == "其他城市":
            provinces = [(d.name, d) for d in sorted(region_dir.iterdir()) if d.is_dir() and d.name != "_复习资料"]
        else:
            continue
        for province, prov_dir in provinces:
            for year_dir in sorted(prov_dir.iterdir()):
                if not year_dir.is_dir():
                    # 散装文件直接在省份目录下（如 北京/2019年北京中考物理试卷.pdf）
                    if year_dir.suffix.lower() in (PDF_EXT | DOC_EXT | ARCH_EXT):
                        groups.append(make_group(province, year_dir.parent.name, year_dir, is_file=True))
                    continue
                year = year_dir.name
                for entry in sorted(year_dir.iterdir()):
                    if entry.name.startswith(".") or entry.name == "未知年份" and False:
                        continue
                    if entry.is_dir():
                        groups.append(make_group(province, year, entry))
                    elif entry.suffix.lower() in (PDF_EXT | DOC_EXT | ARCH_EXT | IMG_EXT):
                        groups.append(make_group(province, year, entry, is_file=True))
    return groups


def make_group(province, year, path, is_file=False):
    if is_file:
        files = [path]
    else:
        files = [f for f in sorted(path.iterdir()) if f.is_file() and not f.name.startswith(".")]
    fmt, nfiles = classify_group_files(files)
    name = path.name
    return {
        "groupId": str(path.relative_to(ROOT)),
        "province": province,
        "year": extract_year(name, year),
        "city": extract_city(name, province),
        "name": name,
        "kind": group_kind(name),
        "format": fmt,
        "nFiles": nfiles,
        "stem": normalize_stem(name),
    }


def pair_papers(groups):
    papers = {}
    for g in groups:
        if g["kind"] == "non-paper":
            continue
        key = (g["province"], g["year"], g["stem"])
        p = papers.setdefault(key, {
            "province": g["province"], "year": g["year"], "city": g["city"],
            "stem": g["stem"], "questionGroups": [], "answerGroups": [],
            "selfContained": False, "nonPaperGroups": 0,
        })
        if g["kind"] in ("question", "both"):
            p["questionGroups"].append(g["groupId"])
        if g["kind"] in ("answer", "both"):
            p["answerGroups"].append(g["groupId"])
        if g["kind"] == "both":
            p["selfContained"] = True
    # 无配对的 answer-only 组也保留（可单独作为答案来源）
    for g in groups:
        if g["kind"] == "unknown":
            continue
    out = []
    for (prov, year, stem), p in sorted(papers.items(), key=lambda kv: (str(kv[0][1]), kv[0][0], kv[0][2])):
        p["hasAnswer"] = bool(p["answerGroups"])
        p["paperId"] = f"{prov}-{p['year']}-{p['stem'][:24] or 'untitled'}"
        out.append(p)
    return out


def main():
    groups = scan_groups()
    papers = pair_papers(groups)
    STATE.mkdir(exist_ok=True)
    (STATE / "inventory.json").write_text(
        json.dumps({"groups": groups, "papers": papers}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    # 统计
    from collections import Counter
    kc = Counter(g["kind"] for g in groups)
    fc = Counter(g["format"] for g in groups if g["kind"] != "non-paper")
    pa = sum(1 for p in papers if p["hasAnswer"])
    pn = sum(1 for p in papers if not p["hasAnswer"] and p["questionGroups"])
    dup = sum(1 for p in papers if len(p["questionGroups"]) > 1)
    print(f"groups: {len(groups)}  kinds: {dict(kc)}")
    print(f"formats(试卷类): {dict(fc)}")
    print(f"papers(配对后): {len(papers)}  有答案: {pa}  无答案: {pn}  多来源重复: {dup}")
    years = Counter(str(p["year"]) for p in papers)
    print("年份分布:", dict(sorted(years.items())))


if __name__ == "__main__":
    main()
