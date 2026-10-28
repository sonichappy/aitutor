#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""解压所有试卷压缩包到同名文件夹，处理中文文件名编码"""
import os
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def fix_name(name):
    """zip 中文文件名常以 cp437 误存，尝试还原为 gbk"""
    try:
        return name.encode("cp437").decode("gbk")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return name

def extract_zip(path, dest):
    ok = 0
    with zipfile.ZipFile(path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            name = fix_name(info.filename)
            name = os.path.basename(name) or name.replace("/", "_")
            target = os.path.join(dest, name)
            if os.path.exists(target):
                continue
            with z.open(info) as src, open(target, "wb") as dst:
                dst.write(src.read())
            ok += 1
    return ok

def extract_rar(path, dest):
    r = subprocess.run(["tar", "-xf", path, "-C", dest],
                       capture_output=True, text=True)
    return r.returncode == 0

def main():
    nzip = nrar = nfail = 0
    fails = []
    for dirpath, _, files in os.walk(ROOT):
        if "_scripts" in dirpath or "_state" in dirpath:
            continue
        for fn in files:
            if not fn.lower().endswith((".zip", ".rar")):
                continue
            path = os.path.join(dirpath, fn)
            dest = os.path.join(dirpath, os.path.splitext(fn)[0] + "_解压")
            if os.path.isdir(dest) and os.listdir(dest):
                continue
            os.makedirs(dest, exist_ok=True)
            try:
                if fn.lower().endswith(".zip"):
                    extract_zip(path, dest)
                    nzip += 1
                else:
                    if extract_rar(path, dest):
                        nrar += 1
                    else:
                        nfail += 1
                        fails.append(path)
            except Exception as e:
                nfail += 1
                fails.append(f"{path} ({e})")
    print(f"zip={nzip} rar={nrar} fail={nfail}")
    for f in fails[:20]:
        print("FAIL:", f)

if __name__ == "__main__":
    main()
