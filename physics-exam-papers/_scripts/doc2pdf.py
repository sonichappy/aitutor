#!/usr/bin/env python3
"""把 .doc/.docx 批量转成 PDF（调用本机 Microsoft Word 的 AppleScript 接口）。

用法：python3 doc2pdf.py <doc路径...> [--out 目录]
输出：_state/docpdf/<原文件名>.pdf，已存在的跳过。
首次运行 macOS 会弹"允许控制 Microsoft Word"授权，请允许。
"""
import subprocess
import sys
from pathlib import Path

STATE = Path(__file__).resolve().parent.parent / "_state"
OUT_DEFAULT = STATE / "docpdf"

APPLESCRIPT = """
on run argv
    set inPath to item 1 of argv
    set outPath to item 2 of argv
    with timeout of 240 seconds
        tell application "Microsoft Word"
            set theDoc to open file name inPath without confirm conversions
            save as theDoc file format format PDF file name outPath
            close theDoc saving no
        end tell
    end timeout
end run
"""


def convert(doc_path, out_dir):
    doc_path = Path(doc_path).resolve()
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / (doc_path.stem + ".pdf")
    if out.exists() and out.stat().st_size > 10000:
        return out, True
    r = subprocess.run(
        ["osascript", "-e", APPLESCRIPT, str(doc_path), str(out)],
        capture_output=True, text=True, timeout=280)
    if r.returncode != 0 or not out.exists():
        return out, False
    return out, True


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    out_dir = OUT_DEFAULT
    if "--out" in sys.argv:
        out_dir = Path(sys.argv[sys.argv.index("--out") + 1])
    ok = fail = 0
    for a in args:
        out, success = convert(a, out_dir)
        status = "✓" if success else "✗"
        print(f"{status} {Path(a).name} -> {out.name}", flush=True)
        ok += success
        fail += (not success)
    print(f"完成：成功 {ok} / 失败 {fail}")


if __name__ == "__main__":
    main()
