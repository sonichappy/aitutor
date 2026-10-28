#!/usr/bin/env python3
"""把 question-bank/physics.db 导出为自包含 HTML 题库浏览器（双击即开）。

用法：python3 export_viewer.py [输出路径]
"""
import json
import sqlite3
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BANK = ROOT / "question-bank"
DB = BANK / "physics.db"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "question-bank" / "题库浏览器.html"

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>初中物理题库浏览器</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"
  onload="renderMath()"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #f5f6f8; color: #222; }
header { background: #1a73e8; color: #fff; padding: 14px 20px; position: sticky; top: 0; z-index: 10; }
header h1 { font-size: 18px; display: inline-block; }
header .stats { font-size: 13px; opacity: .9; margin-left: 12px; }
.controls { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 20px; background: #fff;
  border-bottom: 1px solid #e3e5e8; position: sticky; top: 49px; z-index: 9; }
.controls select, .controls input { padding: 6px 10px; border: 1px solid #d0d3d9;
  border-radius: 6px; font-size: 13px; background: #fff; }
.controls input[type=search] { flex: 1; min-width: 160px; }
.count { font-size: 13px; color: #666; align-self: center; }
main { max-width: 900px; margin: 0 auto; padding: 16px; }
.card { background: #fff; border-radius: 10px; padding: 16px 18px; margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.card .head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; }
.badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.b-num { background: #1a73e8; color: #fff; font-weight: 600; }
.b-uid { background: #fff; color: #5f6368; border: 1px solid #d0d3d9; font-family: monospace; }
.b-seq { background: #e8f0fe; color: #1a73e8; border: 1px solid #c5dafc; font-family: monospace; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 6px; margin: 14px 0; font-size: 13px; }
.pager button { padding: 4px 12px; border: 1px solid #d0d3d9; border-radius: 6px;
  background: #fff; cursor: pointer; font-size: 13px; }
.pager button:disabled { opacity: .4; cursor: default; }
.pager button.cur { background: #1a73e8; color: #fff; border-color: #1a73e8; }
.pager .pinfo { color: #666; margin: 0 6px; }
.b-type { background: #e8f0fe; color: #1a73e8; }
.b-src { background: #f1f3f4; color: #555; }
.b-ans-official { background: #e6f4ea; color: #137333; }
.b-ans-missing { background: #fce8e6; color: #c5221f; }
.b-chapter { background: #fef7e0; color: #b06000; }
.b-topic { background: #f3e8fd; color: #7627bb; }
.stem { font-size: 14.5px; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }
figure.qfig { margin: 10px 0; text-align: center; }
figure.qfig img { max-width: 100%; max-height: 320px; border: 1px solid #e3e5e8;
  border-radius: 8px; cursor: zoom-in; background: #fff; }
figure.qfig figcaption { font-size: 12px; color: #888; margin-top: 4px; }
figure.qfig img.lowconf { border-color: #f9ab00; }
figure.qfig img.suspect { border-color: #c5221f; border-style: dashed; }
.fig { color: #188038; background: #e6f4ea; border-radius: 4px; padding: 1px 6px;
  font-size: 12.5px; }
.blank { color: #1a73e8; font-weight: 600; }
.options { margin: 8px 0 0 4px; font-size: 14px; line-height: 1.8; }
.subq { margin: 8px 0 0 14px; padding-left: 10px; border-left: 3px solid #e3e5e8; }
details.answer { margin-top: 10px; background: #f8f9fa; border-radius: 8px; padding: 8px 12px; }
details.answer summary { cursor: pointer; font-size: 13px; color: #1a73e8; font-weight: 600; }
details.answer .body { margin-top: 6px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
.no-ans { margin-top: 10px; font-size: 12.5px; color: #c5221f; }
footer { text-align: center; color: #999; font-size: 12px; padding: 20px; }
@media (max-width: 600px) { .controls { top: 45px; } }
</style>
</head>
<body>
<header><h1>初中物理题库浏览器</h1><span class="stats" id="stats"></span></header>
<div class="controls">
  <select id="fProvince"><option value="">全部省份</option></select>
  <select id="fYear"><option value="">全部年份</option></select>
  <select id="fType"><option value="">全部题型</option></select>
  <select id="fChapter"><option value="">全部章节</option></select>
  <select id="fAns"><option value="">答案不限</option>
    <option value="official">有官方答案</option><option value="missing">缺答案</option></select>
  <input type="search" id="fSearch" placeholder="搜索题干 / 考点关键词…">
  <span class="count" id="count"></span>
</div>
<main id="list"></main>
<div class="pager" id="pager"></div>
<footer>由 DeepSeek API 题库流水线生成 · 数据内嵌，离线可用（公式渲染需联网加载 KaTeX）</footer>
<script>
const DATA = __DATA__;
const SOURCE_PAPERS = __SOURCE_PAPERS__;
const FIGS = __FIGS__;   // {qid: {figKey: {src, note, label, conf}}}
const TYPE_NAME = {single_choice:"单选",multiple_choice:"多选",fill_blank:"填空",drawing:"作图",
  experiment:"实验探究",calculation:"计算",short_answer:"简答",comprehensive:"综合"};

function esc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function repairLink(qid,key){const f=(FIGS[qid]||{})[key];return f?.reviewId?` <a href="http://127.0.0.1:3012/?id=${f.reviewId}" target="_blank" rel="noopener">查看原卷 / 确认或重新裁图</a>`:"";}
function fmt(s, qid){
  return esc(s).replace(/\\{\\{(blank|fig):(\\d+)\\}\\}/g,(m,kind,key)=>{
    if(kind==='blank')return `<span class="blank">______(${key})______</span>`;
    const f=(FIGS[qid]||{})[key];if(!f)return `<span class="fig">[图槽 ${key}：尚无配图]</span>`;
    const cls=(f.suspect?'suspect ':'')+(f.unchecked?'lowconf':'');
    const warn=f.fallback?'⚠ 暂示原卷整页，需框选配图':f.suspect?'⚠ 配图存疑':f.unchecked?'⚠ 配图尚未人工确认':'';
    return `<figure class="qfig"><img class="${cls}" src="${f.src}" loading="lazy" onclick="window.open(this.src)" alt="${esc(f.note||'').replace(/"/g,'&quot;')}"><figcaption>${warn} ${esc(f.label||'')}${repairLink(qid,key)}</figcaption></figure>`;
  });
}
function renderMath(){
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {delimiters:[
      {left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}]});
  }
}

const papers = {};
DATA.papers.forEach(p => papers[p.paperId] = p);

// 填充筛选器
function fill(id, values){
  const sel = document.getElementById(id);
  values.forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; sel.appendChild(o); });
}
fill("fProvince", [...new Set(DATA.papers.map(p=>p.province))].sort());
fill("fYear", [...new Set(DATA.papers.map(p=>p.year))].filter(Boolean).sort((a,b)=>b-a));
fill("fType", Object.keys(TYPE_NAME).map(t=>t));
const chapterSet = new Set();
DATA.questions.forEach(q => (q.chapters||[]).forEach(c => chapterSet.add(c.chapter)));
fill("fChapter", [...chapterSet].sort());
document.getElementById("fType").options[0].textContent = "全部题型";
Object.keys(TYPE_NAME).forEach((t,i)=>{ document.getElementById("fType").options[i+1].textContent = TYPE_NAME[t]; });

document.getElementById("stats").textContent =
  `共 ${DATA.papers.length} 套卷 · ${DATA.questions.length} 道题`;

function renderQ(q, seq){
  const p = papers[q.paperId] || {};
  const qid = q.qid;
  const chapters = (q.chapters||[]).map(c=>`<span class="badge b-chapter">${esc(c.chapter||"")}</span>`).join("");
  const topics = (q.topics||[]).map(t=>`<span class="badge b-topic">${esc(t)}</span>`).join("");
  let opts = "";
  (q.options||[]).forEach(o=>{ opts += `<div>${esc(o.label)}. ${fmt(o.text, qid)}</div>`; });
  if (opts) opts = `<div class="options">${opts}</div>`;
  let subs = "";
  (q.subQuestions||[]).forEach(s=>{
    subs += `<div class="subq"><b>${esc(String(s.number||""))}</b> ${fmt(s.stem, qid)}</div>`;
  });
  const ans = q.answer || {};
  let ansHtml;
  if (q.answerStatus === "official") {
    const parts = [];
    if (ans.choice) parts.push(`<b>答案：${esc(ans.choice)}</b>`);
    if (ans.blanks && ans.blanks.length) parts.push(`<b>填空答案：</b>${ans.blanks.map(x=>fmt(x,qid)).join("；")}`);
    if (ans.text && !ans.choice) parts.push(fmt(ans.text, qid));
    else if (ans.text && ans.text !== ans.choice) parts.push(fmt(ans.text, qid));
    const subAns = [];
    (q.subQuestions||[]).forEach(s=>{
      const a = s.answer || {};
      const bits = [];
      if (a.choice) bits.push(esc(a.choice));
      if (a.blanks && a.blanks.length) bits.push(a.blanks.map(x=>fmt(x,qid)).join("；"));
      if (a.text && a.text !== a.choice && !(a.blanks||[]).includes(a.text)) bits.push(fmt(a.text, qid));
      if (bits.length) subAns.push(`<b>${esc(String(s.number||""))}</b> ${bits.join("　")}${a.analysis?`<br><span style="color:#5f6368">解析：${fmt(a.analysis, qid)}</span>`:""}`);
    });
    if (subAns.length) parts.push(`<b>子题答案：</b><br>${subAns.join("<br>")}`);
    if (ans.analysis) parts.push(`<b>解析：</b>${fmt(ans.analysis, qid)}`);
    ansHtml = `<details class="answer"><summary>查看答案与解析</summary><div class="body">${parts.join("<br>")}</div></details>`;
  } else {
    ansHtml = `<div class="no-ans">⚠ 该题源站未公布答案</div>`;
  }
  return `<div class="card">
    <div class="head">
      <span class="badge b-seq">#${seq}</span>
      <span class="badge b-num">${esc(q.number)}</span>
      <span class="badge b-uid" title="题库唯一编号">No.${String(q.uid).padStart(4,"0")}</span>
      <span class="badge b-type">${TYPE_NAME[q.type]||q.type}</span>
      <span class="badge b-src">${esc(p.province||"")} · ${esc(p.city||"")} · ${p.year||""}</span>
      <span class="badge ${q.answerStatus==="official"?"b-ans-official":"b-ans-missing"}">${q.answerStatus==="official"?"有答案":"缺答案"}</span>
      ${SOURCE_PAPERS.includes(q.paperId)?`<a href="http://127.0.0.1:3012/paper-source?paperId=${encodeURIComponent(q.paperId)}" target="_blank" rel="noopener">原卷全部页面（可追溯）</a>`:''}
      ${chapters}${topics}
    </div>
    <div class="stem">${fmt(q.stem, qid)}</div>
    ${opts}${subs}${ansHtml}
  </div>`;
}

const PAGE_SIZE = 50;
let filtered = [];
let curPage = 1;

function applyFilter(){
  const prov = document.getElementById("fProvince").value;
  const year = document.getElementById("fYear").value;
  const type = document.getElementById("fType").value;
  const chap = document.getElementById("fChapter").value;
  const ans = document.getElementById("fAns").value;
  const kw = document.getElementById("fSearch").value.trim().toLowerCase();
  filtered = [];
  for (const q of DATA.questions) {
    const p = papers[q.paperId] || {};
    if (new URLSearchParams(location.search).get("pilot")==="chongqing2022" && !["重庆-2022-2022重庆a","重庆-2022-2022重庆b"].includes(q.paperId)) continue;
    if (prov && p.province !== prov) continue;
    if (year && String(p.year) !== year) continue;
    if (type && q.type !== type) continue;
    if (chap && !(q.chapters||[]).some(c=>c.chapter===chap)) continue;
    if (ans && q.answerStatus !== ans) continue;
    if (kw && !((q.stem||"").toLowerCase().includes(kw) ||
                (q.topics||[]).join(" ").toLowerCase().includes(kw))) continue;
    filtered.push(q);
  }
  document.getElementById("count").textContent = `命中 ${filtered.length} 题`;
  curPage = 1;
  renderPage();
}

function renderPage(){
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (curPage > pages) curPage = pages;
  const start = (curPage - 1) * PAGE_SIZE;
  const slice = filtered.slice(start, start + PAGE_SIZE);
  document.getElementById("list").innerHTML =
    slice.map((q, i) => renderQ(q, start + i + 1)).join("");
  // 分页控件
  const pg = document.getElementById("pager");
  if (pages <= 1) { pg.innerHTML = ""; }
  else {
    let btns = `<button ${curPage===1?"disabled":""} onclick="gotoPage(1)">首页</button>
      <button ${curPage===1?"disabled":""} onclick="gotoPage(${curPage-1})">上一页</button>
      <span class="pinfo">第 ${curPage} / ${pages} 页（共 ${total} 题）</span>`;
    // 页码窗口
    const win = [];
    const lo = Math.max(1, curPage - 3), hi = Math.min(pages, curPage + 3);
    for (let i = lo; i <= hi; i++) win.push(i);
    win.forEach(i => {
      btns += `<button class="${i===curPage?"cur":""}" onclick="gotoPage(${i})">${i}</button>`;
    });
    btns += `<button ${curPage===pages?"disabled":""} onclick="gotoPage(${curPage+1})">下一页</button>
      <button ${curPage===pages?"disabled":""} onclick="gotoPage(${pages})">末页</button>`;
    pg.innerHTML = btns;
  }
  renderMath();
  window.scrollTo({top: 0, behavior: "instant"});
}
function gotoPage(n){ curPage = n; renderPage(); }
["fProvince","fYear","fType","fChapter","fAns"].forEach(id =>
  document.getElementById(id).addEventListener("change", applyFilter));
let timer;
document.getElementById("fSearch").addEventListener("input", ()=>{
  clearTimeout(timer); timer = setTimeout(applyFilter, 250);
});
applyFilter();
</script>
</body>
</html>
"""


def main():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    papers = [dict(r) for r in db.execute(
        "SELECT paperId, province, city, year, nQuestions, hasAnswer FROM papers WHERE nQuestions>0")]
    ok_pids = {p["paperId"] for p in papers}
    questions = []
    for r in db.execute("SELECT * FROM questions"):
        q = dict(r)
        if q["paperId"] not in ok_pids:
            continue
        for k in ("options", "blanks", "subQuestions", "chapters", "topics", "answerBlanks"):
            try:
                q[k] = json.loads(q[k]) if q[k] else []
            except json.JSONDecodeError:
                q[k] = []
        q["answer"] = {"choice": q.pop("answerChoice"), "blanks": q.pop("answerBlanks"),
                       "text": q.pop("answerText"), "analysis": q.pop("analysis")}
        questions.append(q)
    import re as _re

    def num_key(s):
        """题号转排序键：提取数字升序，非数字排最后。"""
        m = _re.search(r"\d+", str(s or ""))
        return (0, int(m.group())) if m else (1, 0)

    # 试卷按 省份→城市→年份 排序，题目按 试卷顺序→题号数值 升序
    papers.sort(key=lambda p: (p["province"] or "", p["city"] or "", p["year"] or 0))
    order = {p["paperId"]: i for i, p in enumerate(papers)}
    questions.sort(key=lambda q: (order.get(q["paperId"], 9999), num_key(q["number"])))
    # 全局唯一编号：持久化在 questions.uid，已有编号保持不变，新题递增分配
    cols = {r[1] for r in db.execute("PRAGMA table_info(questions)")}
    if "uid" not in cols:
        db.execute("ALTER TABLE questions ADD COLUMN uid INTEGER")
        db.commit()
    have_uid = {q["qid"]: q.get("uid") for q in questions}
    max_uid = db.execute("SELECT COALESCE(MAX(uid),0) FROM questions").fetchone()[0]
    changed = False
    for q in questions:
        if not q.get("uid"):
            max_uid += 1
            q["uid"] = max_uid
            db.execute("UPDATE questions SET uid=? WHERE qid=?", (max_uid, q["qid"]))
            changed = True
    if changed:
        db.commit()
    # Automatically display staged candidates, without promoting them to confirmed figures.
    import hashlib, shutil
    staged = {}
    queue = ROOT / '_state/recurring_figures/queue.db'
    if queue.exists():
        with sqlite3.connect(f'file:{queue}?mode=ro', uri=True) as qc:
            for fid, candidate in qc.execute("SELECT figureId,candidatePath FROM jobs WHERE state='awaiting_visual_acceptance' AND candidatePath IS NOT NULL"):
                source = Path(candidate)
                if source.resolve().is_relative_to(ROOT.resolve()) and source.is_file():
                    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:16]
                    rel = 'assets/auto_candidate_' + str(fid) + '_' + digest + '.png'
                    if not (BANK/rel).exists(): shutil.copyfile(source,BANK/rel)
                    staged[fid] = rel
    # 配图映射
    figs = {}
    try:
        cols = {r[1] for r in db.execute("PRAGMA table_info(figures)")}
        has_ms = "matchStatus" in cols
        for r in db.execute(
                "SELECT qid, figKey, label, imagePath, note, cropConfidence, id"
                + (", matchStatus" if has_ms else "") + " FROM figures"):
            if has_ms:
                qid, key, label, path, note, conf, fid, ms = r
            else:
                qid, key, label, path, note, conf, fid = r
                ms = None
            automatic = fid in staged and ms != "human_confirmed"
            if automatic: path = staged[fid]
            if (BANK / path).exists():
                figs.setdefault(qid, {})[key] = {
                    "reviewId": fid if qid.startswith(("重庆-2022-2022重庆a", "重庆-2022-2022重庆b")) else None,
                    "src": path, "label": label or "", "note": note or "",
                    "conf": conf or 0.9, "suspect": 1 if ms == "suspect" else 0,
                    "fallback": ms == "source_fallback" and not automatic,
                    "unchecked": 0 if ms == "human_confirmed" else 1}
    except sqlite3.OperationalError:
        pass  # figures 表还没建
    source_papers=[]
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='paper_source_manifests'").fetchone():
        source_papers=[r[0] for r in db.execute('SELECT paperId FROM paper_source_manifests')]
    data = {"papers": papers, "questions": questions}
    payload = json.dumps(data, ensure_ascii=False)
    fig_payload = json.dumps(figs, ensure_ascii=False)
    html = (HTML_TEMPLATE
            .replace("__DATA__", payload)
            .replace("__SOURCE_PAPERS__", json.dumps(source_papers,ensure_ascii=False))
            .replace("__FIGS__", fig_payload))
    n_fig = sum(len(v) for v in figs.values())
    temp=OUT.with_name(OUT.name+"."+uuid.uuid4().hex+".tmp")
    temp.write_text(html,encoding="utf-8")
    temp.replace(OUT)
    print(f"已生成 {OUT}（{len(papers)} 套卷 / {len(questions)} 题 / "
          f"{n_fig} 张配图 / {OUT.stat().st_size/1e6:.1f} MB）")


if __name__ == "__main__":
    main()
