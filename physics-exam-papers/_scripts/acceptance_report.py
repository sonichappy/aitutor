#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成题库验收报告（Markdown）。可随时运行，反映数据库当前状态。"""
import json
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "question-bank" / "physics.db"
STATE = ROOT / "_state"
OUT = ROOT / "question-bank" / "验收报告.md"

db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row

q = lambda sql, *a: db.execute(sql, a).fetchall()
one = lambda sql, *a: db.execute(sql, a).fetchone()[0]

papers = one("SELECT COUNT(*) FROM papers")
papers_ans = one("SELECT COUNT(*) FROM papers WHERE hasAnswer=1")
questions = one("SELECT COUNT(*) FROM questions")
qs_ans = one("SELECT COUNT(*) FROM questions WHERE answerStatus='official'")
figures = one("SELECT COUNT(*) FROM figures")
fig_ok = one("SELECT COUNT(*) FROM figures WHERE matchStatus='ok'")
fig_sus = one("SELECT COUNT(*) FROM figures WHERE matchStatus='suspect'")
fig_fill = one("SELECT COUNT(*) FROM figures WHERE page LIKE 'fill:%'")
# Include options, recursive subquestions, answers and prose references.
from figure_slots import audit, slots
fig_slot = sum(len(slots(dict(r))) for r in q("SELECT * FROM questions"))
gap_report = audit(db, DB.parent)
no_fig_q = gap_report["missingQuestions"]
missing_slots = gap_report["missingSlots"]

by_type = q("""SELECT type, COUNT(*) c FROM questions GROUP BY type ORDER BY c DESC""")
by_prov = q("""SELECT p.province, COUNT(DISTINCT p.paperId) np, COUNT(*) nq
               FROM questions q JOIN papers p ON q.paperId=p.paperId
               GROUP BY p.province ORDER BY np DESC""")
by_year = q("""SELECT p.year, COUNT(*) c FROM questions q JOIN papers p ON q.paperId=p.paperId
               GROUP BY p.year ORDER BY p.year""")
chap = Counter()
for r in q("SELECT chapters FROM questions"):
    try:
        for c in json.loads(r["chapters"] or "[]"):
            chap[c.get("chapter", "?")] += 1
    except Exception:
        pass

fails = []
fp = STATE / "pipeline_failures.json"
if fp.exists():
    fails = json.loads(fp.read_text())

TYPE_NAME = {"single_choice": "单选", "multiple_choice": "多选", "fill_blank": "填空",
             "short_answer": "简答", "drawing": "作图", "experiment": "实验探究",
             "calculation": "计算", "comprehensive": "综合"}

L = []
L.append(f"# 初中物理题库验收报告\n")
L.append(f"生成时间：{datetime.now():%Y-%m-%d %H:%M}\n")
L.append("## 一、总体规模\n")
L.append("| 指标 | 数量 |")
L.append("|---|---|")
L.append(f"| 试卷 | {papers} 套（含官方答案 {papers_ans} 套） |")
L.append(f"| 题目 | {questions} 道（有答案 {qs_ans} 道，占 {qs_ans*100//max(questions,1)}%） |")
L.append(f"| 配图 | {figures} 张（复核匹配 {fig_ok} / 存疑 {fig_sus} / 补缺补全 {fig_fill}） |")
L.append(f"| 题干图槽位 | {fig_slot} 个，缺失槽位 {missing_slots} 个；有缺图迹象的题 {no_fig_q} 道 |")
L.append("")
L.append("## 二、题型分布\n")
L.append("| 题型 | 题数 |")
L.append("|---|---|")
for r in by_type:
    L.append(f"| {TYPE_NAME.get(r['type'], r['type'])} | {r['c']} |")
L.append("")
L.append("## 三、省份分布\n")
L.append("| 省份 | 试卷套数 | 题数 |")
L.append("|---|---|---|")
for r in by_prov:
    L.append(f"| {r['province']} | {r['np']} | {r['nq']} |")
L.append("")
L.append("## 四、年份分布\n")
L.append("| 年份 | 题数 |")
L.append("|---|---|")
for r in by_year:
    L.append(f"| {r['year']} | {r['c']} |")
L.append("")
L.append("## 五、教材章节覆盖（Top 20）\n")
L.append("| 章节 | 题数 |")
L.append("|---|---|")
for c, n in chap.most_common(20):
    L.append(f"| {c} | {n} |")
L.append("")
L.append("## 六、配图质量\n")
L.append(f"- 视觉复核通过：{fig_ok} 张")
L.append(f"- 存疑待人工抽查（浏览器红框标注）：{fig_sus} 张")
L.append(f"- 由补缺流程补全：{fig_fill} 张")
L.append(f"- 仍缺配图的题：{no_fig_q} 道（含普通引图文字，需核查来源，不能推断源文件缺图）")
rep = STATE / "final_fig_report.txt"
if rep.exists():
    L.append(f"\n存疑明细：`_state/final_fig_report.txt`")
L.append("")
L.append("## 七、批跑失败清单\n")
if fails:
    L.append("| 试卷 | 原因 |")
    L.append("|---|---|")
    for f in fails:
        L.append(f"| {f['paperId']} | {f['error'][:60]} |")
else:
    L.append("无失败记录（或批跑未结束）。")
L.append("")
L.append("## 八、数据存储说明\n")
L.append("- 数据库：`question-bank/physics.db`（papers / questions / figures 三表）")
L.append("- 每题唯一编号：questions.uid，浏览器中显示为 No.xxxx，持久不变")
L.append("- 配图文件：`question-bank/assets/`，文件名规则 `{paperId}_{题号}_fig{N}.png`")
L.append("- 浏览入口：`question-bank/题库浏览器.html`（双击打开，支持筛选/搜索/分页）")
L.append("")

OUT.write_text("\n".join(L), encoding="utf-8")
print(f"已生成 {OUT}")
print(f"试卷{papers} 题{questions} 图{figures}(ok{fig_ok}/sus{fig_sus}) 缺图题{no_fig_q} 失败{len(fails)}")
