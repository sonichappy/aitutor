#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中考网(zhongkao.com)中考物理真题采集脚本
阶段1: 抓取物理真题频道列表 -> articles.json
阶段2: 逐篇文章提取附件/正文图片 -> assets.json
阶段3: 下载资源到 physics-exam-papers/ 目录
所有阶段均可断点续跑。
"""
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # physics-exam-papers/
STATE = os.path.join(ROOT, "_state")
os.makedirs(STATE, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"

ARTICLE_RE = re.compile(r'href="(https?://(?:www|m|[a-z]{2})\.zhongkao\.com/e/(\d{8})/([0-9a-f]+)(?:_\d+)?\.shtml)"[^>]*>([^<]{4,120})<', re.I)
ATTACH_RE = re.compile(r'href="(https?://files\.eduuu\.com/[^"]+?\.(?:zip|rar|doc|docx|pdf))"', re.I)
IMG_RE = re.compile(r'<img[^>]+src="(https?://files\.eduuu\.com/[^"]+?\.(?:png|jpg|jpeg|gif))"', re.I)
PAGE_RE = re.compile(r'href="(https?://(?:www|m|[a-z]{2})\.zhongkao\.com/e/\d{8}/[0-9a-f]+_(\d+)\.shtml)"')

BANNER_IDS = {
    "152742_67c6ab6e712b9", "151927_67c6a97f3eee4", "201758_5cb4767698bff",
    "174130_645b66ca28b87", "163610_63622bfab0c50", "141535_629eed07b97e9",
    "110226_5f07da42a94eb", "140556_60598544c1490", "161213_60b9e05d3af16",
}

PROVINCES = ["北京", "天津", "上海", "重庆", "河北", "山西", "江苏", "浙江", "安徽", "福建",
             "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "四川", "贵州",
             "云南", "辽宁", "吉林", "黑龙江", "内蒙古", "甘肃", "陕西", "宁夏", "青海",
             "西藏", "新疆"]

# 城市 -> 省份（标题不含省份名时的回退映射）
CITY_PROV = {
    "成都": "四川", "广州": "广东", "深圳": "广东", "长沙": "湖南", "大连": "辽宁",
    "沈阳": "辽宁", "合肥": "安徽", "杭州": "浙江", "宁波": "浙江", "济南": "山东",
    "青岛": "山东", "南京": "江苏", "苏州": "江苏", "无锡": "江苏", "武汉": "湖北",
    "西安": "陕西", "郑州": "河南", "太原": "山西", "长春": "吉林", "哈尔滨": "黑龙江",
    "福州": "福建", "厦门": "福建", "南昌": "江西", "昆明": "云南", "贵阳": "贵州",
    "兰州": "甘肃", "石家庄": "河北", "南宁": "广西", "海口": "海南", "呼和浩特": "内蒙古",
    "银川": "宁夏", "西宁": "青海", "乌鲁木齐": "新疆", "拉萨": "西藏",
}

CITY_CHANNELS = ["bj", "cd", "cq", "cs", "dl", "gz", "hf", "hz", "jn", "nb",
                 "nj", "qd", "sh", "su", "sy", "sz", "tj", "ty", "wh", "wx", "xa", "zz"]

def fetch(url, binary=False, retries=2, timeout=12):
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            if binary:
                return data
            for enc in ("utf-8", "gbk"):
                try:
                    return data.decode(enc)
                except UnicodeDecodeError:
                    continue
            return data.decode("utf-8", errors="ignore")
        except Exception as e:
            if i == retries - 1:
                return None
            time.sleep(1.5 * (i + 1))

def load_json(name, default):
    p = os.path.join(STATE, name)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return default

def save_json(name, obj):
    p = os.path.join(STATE, name)
    with open(p + ".tmp", "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(p + ".tmp", p)

# ---------------- 阶段1: 频道列表 ----------------
def phase1(max_pages=305):
    articles = load_json("articles.json", {})
    done_pages = set(load_json("list_pages_done.json", []))
    for n in range(1, max_pages + 1):
        if n in done_pages:
            continue
        url = "https://www.zhongkao.com/zyk/zkzt/wlzt/" + ("index.shtml" if n == 1 else f"index_{n}.shtml")
        html = fetch(url)
        if not html:
            print(f"[list] page {n} fetch failed, will retry later")
            continue
        found = 0
        for m in ARTICLE_RE.finditer(html):
            full, date8, aid, title = m.group(1), m.group(2), m.group(3), m.group(4).strip()
            base = f"https://www.zhongkao.com/e/{date8}/{aid}.shtml"
            if not re.search(r"中考|真题", title):
                continue
            if re.search(r"模拟|一模|二模|月考|期中|期末|压轴|知识点|复习|练习|作文|分数|时间|报名|成绩", title):
                continue
            if not re.search(r"物理|理综|科学", title):
                continue
            if base not in articles:
                articles[base] = {"title": title, "url": base}
                found += 1
        done_pages.add(n)
        if n % 20 == 0:
            save_json("articles.json", articles)
            save_json("list_pages_done.json", sorted(done_pages))
            print(f"[list] page {n}/{max_pages}, articles={len(articles)}", flush=True)
        time.sleep(0.15)
    save_json("articles.json", articles)
    save_json("list_pages_done.json", sorted(done_pages))
    print(f"[list] DONE total={len(articles)}")

# ---------------- 阶段2: 提取资源 ----------------
def parse_article(url):
    """返回 (attachments, images, dead) ；dead=True 表示暂无内容"""
    html = fetch(url)
    if html is None:
        return None
    if ("暂未公布" in html or "尚未公布" in html) and "eduuu" not in html.split("暂未公布")[0][-200:]:
        pass  # 仍需检查是否有附件
    # 分页
    pages = {int(m.group(2)): m.group(1) for m in PAGE_RE.finditer(html)}
    htmls = [html]
    for pn in sorted(pages)[:25]:
        h = fetch(pages[pn])
        if h:
            htmls.append(h)
    attachments, images = [], []
    for h in htmls:
        # 去掉广告滑块区域
        h2 = re.sub(r'<div class="focusBox">.*?</div>\s*<!--AdForward End-->', "", h, flags=re.S)
        for m in ATTACH_RE.finditer(h2):
            if m.group(1) not in attachments:
                attachments.append(m.group(1))
        for m in IMG_RE.finditer(h2):
            u = m.group(1)
            bid = u.rsplit("/", 1)[-1].rsplit(".", 1)[0]
            if bid in BANNER_IDS:
                continue
            if u not in images:
                images.append(u)
    dead = (not attachments) and (not images)
    return attachments, images, dead

def phase2(workers=8):
    articles = load_json("articles.json", {})
    assets = load_json("assets.json", {})
    todo = [u for u in articles if u not in assets]
    print(f"[parse] todo={len(todo)} done={len(assets)}", flush=True)
    count = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(parse_article, u): u for u in todo}
        for fut in as_completed(futs):
            u = futs[fut]
            try:
                res = fut.result()
            except Exception:
                res = None
            if res is None:
                continue  # 下次重试
            att, img, dead = res
            assets[u] = {"title": articles[u]["title"], "attachments": att, "images": img, "dead": dead}
            count += 1
            if count % 50 == 0:
                save_json("assets.json", assets)
                print(f"[parse] {count}/{len(todo)}", flush=True)
    save_json("assets.json", assets)
    ok = sum(1 for v in assets.values() if not v["dead"])
    print(f"[parse] DONE total={len(assets)} with-assets={ok}")

# ---------------- 阶段3: 下载 ----------------
def parse_meta(title):
    year = None
    m = re.search(r"(20[12]\d)\s*年", title)
    if m:
        year = m.group(1)
    prov = None
    for p in PROVINCES:
        if p in title:
            prov = p
            break
    if not prov:
        for c, p in CITY_PROV.items():
            if c in title:
                prov = p
                break
    return year or "未知年份", prov or "未知省份"

# ---------------- 阶段1c: 城市子站频道 ----------------
def phase1c():
    articles = load_json("articles.json", {})
    done = set(load_json("city_pages_done.json", []))
    for cc in CITY_CHANNELS:
        for n in range(1, 40):
            key = f"{cc}:{n}"
            if key in done:
                continue
            url = f"http://{cc}.zhongkao.com/beikao/zkzt/wl/" + ("index.shtml" if n == 1 else f"index_{n}.shtml")
            html = fetch(url)
            if not html:
                break  # 该城市频道不存在或到底
            found = 0
            for m in ARTICLE_RE.finditer(html):
                full, date8, aid, title = m.group(1), m.group(2), m.group(3), m.group(4).strip()
                host = re.match(r'https?://([a-z0-9.]+)', full).group(1)
                base = f"http://{host}/e/{date8}/{aid}.shtml"
                if not re.search(r"中考|真题", title):
                    continue
                if re.search(r"模拟|一模|二模|月考|期中|期末|压轴|知识点|复习|练习|作文|分数|时间|报名|成绩|招生|录取|志愿|中学$", title):
                    continue
                if not re.search(r"物理|理综|科学", title):
                    continue
                if base not in articles:
                    articles[base] = {"title": title, "url": base}
                    found += 1
            done.add(key)
            total_links = len(ARTICLE_RE.findall(html))
            if total_links == 0:
                break  # 页面不存在或无文章
            time.sleep(0.1)
        save_json("articles.json", articles)
        save_json("city_pages_done.json", sorted(done))
        print(f"[city] {cc} done, articles={len(articles)}", flush=True)
    print(f"[city] DONE total={len(articles)}")

def safe_name(s, maxlen=90):
    s = re.sub(r'[\\/:*?"<>|\s]+', "", s)
    return s[:maxlen]

def download_one(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return True
    data = fetch(url, binary=True, retries=3, timeout=60)
    if not data:
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return True

def phase3(workers=8):
    assets = load_json("assets.json", {})
    # 统计图片全局频率，过滤网站装饰图（二维码/横幅在数千篇文章中重复出现）
    from collections import Counter
    img_freq = Counter()
    for a in assets.values():
        for u in set(a["images"]):
            img_freq[u] += 1
    tasks = []
    for url, a in assets.items():
        imgs = [u for u in a["images"] if img_freq[u] <= 3]
        atts = a["attachments"]
        if not imgs and not atts:
            continue
        year, prov = parse_meta(a["title"])
        if prov == "北京":
            base_dir = os.path.join(ROOT, "北京", year)
        else:
            base_dir = os.path.join(ROOT, "其他城市", prov, year)
        tname = safe_name(a["title"])
        for i, att in enumerate(atts):
            ext = att.rsplit(".", 1)[-1].lower()
            fn = f"{tname}" + (f"_附件{i+1}" if len(atts) > 1 else "") + f".{ext}"
            tasks.append((att, os.path.join(base_dir, fn)))
        if imgs:
            img_dir = os.path.join(base_dir, tname + "_图片版")
            for i, im in enumerate(imgs):
                ext = im.rsplit(".", 1)[-1].lower()
                tasks.append((im, os.path.join(img_dir, f"{i+1:02d}.{ext}")))
    print(f"[dl] tasks={len(tasks)}", flush=True)
    ok = fail = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(download_one, u, p): (u, p) for u, p in tasks}
        for fut in as_completed(futs):
            if fut.result():
                ok += 1
            else:
                fail += 1
            if (ok + fail) % 100 == 0:
                print(f"[dl] ok={ok} fail={fail}", flush=True)
    print(f"[dl] DONE ok={ok} fail={fail}")

# ---------------- 阶段1d: 特殊路径城市频道 ----------------
def phase1d():
    extra = [
        ("sh", "http://sh.zhongkao.com/stpd/zkzt/wlzt/"),
        ("wh", "http://wh.zhongkao.com/beikao/zkzt/lh/"),
        ("tj", "http://tj.zhongkao.com/zkbk/zkzt/wl/"),
    ]
    articles = load_json("articles.json", {})
    done = set(load_json("city2_pages_done.json", []))
    for cc, base_url in extra:
        for n in range(1, 40):
            key = f"{cc}:{n}"
            if key in done:
                continue
            url = base_url + ("index.shtml" if n == 1 else f"index_{n}.shtml")
            html = fetch(url)
            if not html or "404" in (html[:2000] or ""):
                break
            for m in ARTICLE_RE.finditer(html):
                full, date8, aid, title = m.group(1), m.group(2), m.group(3), m.group(4).strip()
                host = re.match(r'https?://([a-z0-9.]+)', full).group(1)
                base = f"http://{host}/e/{date8}/{aid}.shtml"
                if not re.search(r"中考|真题", title):
                    continue
                if re.search(r"模拟|一模|二模|月考|期中|期末|压轴|知识点|复习|练习|作文|分数|时间|报名|成绩|招生|录取|志愿", title):
                    continue
                if not re.search(r"物理|理综|科学|理化", title):
                    continue
                if base not in articles:
                    articles[base] = {"title": title, "url": base}
            done.add(key)
            if len(ARTICLE_RE.findall(html)) == 0:
                break
            time.sleep(0.1)
        save_json("articles.json", articles)
        save_json("city2_pages_done.json", sorted(done))
        print(f"[city2] {cc} done, articles={len(articles)}", flush=True)
    print(f"[city2] DONE total={len(articles)}")

if __name__ == "__main__":
    phase = sys.argv[1] if len(sys.argv) > 1 else "all"
    if phase in ("1", "all"):
        phase1()
    if phase in ("1c", "all"):
        phase1c()
    if phase in ("1d", "all"):
        phase1d()
    if phase in ("2", "all"):
        phase2()
    if phase in ("3", "all"):
        phase3()
