#!/usr/bin/env python3
"""方案二可行性测试：Kimi 视觉返回页面插图的 bounding box，裁剪后人工核验。"""
import base64
import json
import os
import re
import sys
from pathlib import Path

import requests

BASE_URL = os.environ["KIMI_BASE_URL"].rstrip("/")
API_KEY = os.environ["KIMI_API_KEY"]

PROMPT = """这是一页中考物理试卷扫描件。请找出本页中所有【插图】（实验装置图、电路图、坐标图、照片、示意图等，不含纯文字表格），以 JSON 输出：
{"figures": [{"label": "图17", "desc": "一句话描述", "box": [x0, y0, x1, y1]}]}
- label：图上印的编号（如 图17、图18甲），无编号则给简短名
- box：归一化坐标 [左, 上, 右, 下]，0-1 之间，精确框住插图区域（含图内标注文字，不含正文文字）
- 只输出 JSON"""

img_path = sys.argv[1]
b64 = base64.b64encode(Path(img_path).read_bytes()).decode()
r = requests.post(
    f"{BASE_URL}/chat/completions",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={"model": "k3-agent", "max_tokens": 2048, "messages": [{"role": "user", "content": [
        {"type": "text", "text": PROMPT},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}}]}]},
    timeout=180,
)
r.raise_for_status()
content = r.json()["choices"][0]["message"]["content"]
print("模型输出:", content[:800])
m = re.search(r"\{.*\}", content, re.DOTALL)
data = json.loads(m.group(0))

from PIL import Image
im = Image.open(img_path)
W, H = im.size
print(f"\n页面尺寸: {W}x{H}")
out_dir = Path("/tmp/fig_crop_test")
out_dir.mkdir(exist_ok=True)
for i, f in enumerate(data["figures"]):
    x0, y0, x1, y1 = f["box"]
    crop = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
    out = out_dir / f"fig{i}_{f['label'].replace('/', '_')}.png"
    crop.save(out)
    print(f"{f['label']}: {f['desc'][:40]} box={f['box']} -> {out} ({crop.size[0]}x{crop.size[1]})")
