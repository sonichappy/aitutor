#!/usr/bin/env python3
"""单页 OCR 试点：验证 Kimi 网关视觉模型对试卷扫描件的识别能力。"""
import base64
import json
import os
import sys

import requests

BASE_URL = os.environ["KIMI_BASE_URL"].rstrip("/")
API_KEY = os.environ["KIMI_API_KEY"]

OCR_PROMPT = """这是一页中国初中物理中考真题的扫描件。请完整、逐字地将本页内容转录为 Markdown。

要求：
1. 保持题目编号（如"1．""15."等大题/小题编号原样保留）。
2. 选择题的选项用 A. B. C. D. 分行书写。
3. 物理公式、数值、单位用 LaTeX 表示（行内公式用 $...$），如 $v=\\frac{s}{t}$、$2\\times 10^3\\ \\mathrm{kg/m^3}$。
4. 图片、图表、坐标图、电路图等无法转录的图形，在原位置插入占位符 [图N]（N 从 1 开始本页内编号），并用一句话简述图形内容，如 [图1：探究平面镜成像实验装置图]。
5. 忽略页眉页脚、水印（如"XX教育考试院""XX网"字样）、装订线、页码。
6. 不要添加任何解释、点评或额外内容，只输出转录的 Markdown 正文。"""


def ocr_page(image_path: str, model: str = "k3-agent") -> str:
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": OCR_PROMPT},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            }
        ],
        "max_tokens": 8192,
    }
    resp = requests.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json=payload,
        timeout=180,
    )
    resp.raise_for_status()
    data = resp.json()
    if data.get("usage"):
        print(f"[usage] {json.dumps(data['usage'])}", file=sys.stderr)
    return data["choices"][0]["message"]["content"]


if __name__ == "__main__":
    img = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "k3-agent"
    print(ocr_page(img, model))
