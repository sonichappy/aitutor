#!/usr/bin/env python3
"""重置试卷处理状态：删除其 OCR 组缓存、结构化缓存、DB 记录与完成标记。
用法：
  python3 reset_papers.py --zero            重置所有 nQuestions=0 的试卷
  python3 reset_papers.py <paperId> [...]   重置指定试卷
"""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "_state"


def reset(pid, pmap, db, done):
    p = pmap.get(pid)
    if not p:
        print(f"  跳过（不在 inventory）: {pid}")
        return
    h = hashlib.md5(pid.encode()).hexdigest()[:10]
    f = STATE / "ocr" / "structure" / f"{h}.json"
    if f.exists():
        f.unlink()
    cd = STATE / "ocr" / "structure_chunks" / h
    if cd.exists():
        for x in cd.glob("*.json"):
            x.unlink()
    for gid in p["questionGroups"] + p["answerGroups"]:
        gh = hashlib.md5(gid.encode()).hexdigest()[:10]
        gf = STATE / "ocr" / f"{gh}.json"
        if gf.exists():
            gf.unlink()
    db.execute("DELETE FROM questions WHERE paperId=?", (pid,))
    db.execute("DELETE FROM papers WHERE paperId=?", (pid,))
    done.discard(pid)
    print(f"  已重置: {pid}")


def main():
    args = sys.argv[1:]
    inv = json.loads((STATE / "inventory.json").read_text(encoding="utf-8"))
    pmap = {p["paperId"]: p for p in inv["papers"]}
    db = sqlite3.connect(ROOT / "question-bank" / "physics.db")
    done_file = STATE / "pipeline_done.json"
    done = set(json.loads(done_file.read_text())) if done_file.exists() else set()
    if args == ["--zero"]:
        targets = [r[0] for r in db.execute(
            "SELECT paperId FROM papers WHERE nQuestions=0").fetchall()]
    else:
        targets = args
    for pid in targets:
        reset(pid, pmap, db, done)
    db.commit()
    done_file.write_text(json.dumps(sorted(done), ensure_ascii=False))
    print(f"共重置 {len(targets)} 套")


if __name__ == "__main__":
    main()
