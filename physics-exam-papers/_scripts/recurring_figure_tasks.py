"""Recurring DeepSeek candidate pipeline; production question bank is read-only.

API calls are restricted to Shanghai noon/night windows. A detached supervisor
enforces cutoff and a persistent STOP flag disables subsequent scheduled runs.
"""
import argparse
import fcntl
import hashlib
import json
import os
import signal
import sqlite3
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / '_state/recurring_figures'
TZ = ZoneInfo('Asia/Shanghai')
PROMPT_VERSION = 'grid-slot-candidate-v1'

def window_at(now=None):
    now = now or datetime.now(TZ)
    noon = now.replace(hour=12, minute=0, second=0, microsecond=0)
    evening = noon.replace(hour=18)
    if noon <= now < noon.replace(hour=14):
        return 'noon', noon.replace(hour=14)
    if now >= evening:
        return 'night', (now + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)
    if now < now.replace(hour=9, minute=0, second=0, microsecond=0):
        return 'night', now.replace(hour=9, minute=0, second=0, microsecond=0)
    return None, None

def db_open():
    STATE.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(STATE / 'queue.db', timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('''CREATE TABLE IF NOT EXISTS jobs(
        figureId INTEGER PRIMARY KEY, qid TEXT, figKey TEXT, paperId TEXT,
        originalPath TEXT, questionJson TEXT, sourcePaths TEXT, slotScope TEXT,
        fingerprint TEXT, state TEXT, candidatePath TEXT, sourceBoxes TEXT,
        localChecks TEXT, review TEXT, attempts INTEGER DEFAULT 0, updatedAt TEXT)''')
    db.execute('''CREATE TABLE IF NOT EXISTS calls(
        id INTEGER PRIMARY KEY, session TEXT, figureId INTEGER, phase TEXT,
        httpStatus INTEGER, promptTokens INTEGER, completionTokens INTEGER,
        elapsed REAL, outcome TEXT, createdAt TEXT)''')
    db.execute('''CREATE TABLE IF NOT EXISTS runs(
        session TEXT PRIMARY KEY, phase TEXT, state TEXT, deadline TEXT,
        controllerPid INTEGER, workerPid INTEGER, startedAt TEXT, endedAt TEXT)''')
    db.commit()
    return db

def seed():
    """Stage gate: Chongqing only until visually accepted; never promote on model pass."""
    from source_figure_review import PAPERS, source_pages
    from figure_slots import PLACEHOLDER, parsed
    accepted_ids = set()
    for path in [ROOT / '_state/chongqing_sample_20261014/report.json',
                 ROOT / '_state/chongqing_2022_review/report.json']:
        if path.exists():
            report = json.loads(path.read_text())
            for r in report.get('samples', []) + report.get('results', []):
                if r.get('applied') or r.get('humanReview') == 'confirmed':
                    accepted_ids.add(r['id'])
    source_db = sqlite3.connect(f'file:{ROOT}/question-bank/physics.db?mode=ro', uri=True)
    source_db.row_factory = sqlite3.Row
    db = db_open()
    rows = source_db.execute('SELECT f.*,q.paperId,q.number,q.stem,q.options,q.subQuestions,q.answerText '
                             'FROM figures f JOIN questions q USING(qid) WHERE q.paperId IN (?,?)', tuple(PAPERS)).fetchall()
    for row in rows:
        q = dict(row)
        if q.get('matchStatus') == 'human_confirmed':
            db.execute("UPDATE jobs SET state='human_confirmed' WHERE figureId=?",(q['id'],))
            continue
        if q['id'] in accepted_ids:
            continue
        scope = []
        def walk(node, label):
            for option in parsed(node.get('options')):
                if isinstance(option, dict) and any(m.group(1) == str(q['figKey']) for m in PLACEHOLDER.finditer(option.get('text') or '')):
                    scope.append(label + '/选项' + str(option.get('label')) + '，仅此选项配图：' + option.get('text', ''))
            for field in ('stem', 'answerText'):
                text = node.get(field) or ''
                for m in PLACEHOLDER.finditer(text):
                    if m.group(1) == str(q['figKey']):
                        scope.append(label + '/' + field + '，引用附近：' + text[max(0, m.start()-24):m.end()+160])
            for sub in parsed(node.get('subQuestions')):
                walk(sub, label + '/子题' + str(sub.get('number')))
        walk(q, '题目')
        pages = [ROOT / '其他城市/重庆/2022' / PAPERS[q['paperId']] / f'{p:02d}.png' for p in source_pages(q['number'])]
        original = ROOT / 'question-bank' / q['imagePath']
        if not original.is_file() or any(not p.is_file() for p in pages):
            continue
        scope_text = '\n'.join(scope) or '槽位不明确：必须uncertain，不要猜'
        fingerprint = hashlib.sha256(original.read_bytes() + ''.join(hashlib.sha256(p.read_bytes()).hexdigest() for p in pages).encode() +
                                     (json.dumps(q, ensure_ascii=False, sort_keys=True)+scope_text+PROMPT_VERSION).encode()).hexdigest()
        previous = db.execute('SELECT fingerprint FROM jobs WHERE figureId=?', (q['id'],)).fetchone()
        if previous and previous['fingerprint'] == fingerprint:
            continue
        db.execute('''INSERT OR REPLACE INTO jobs(figureId,qid,figKey,paperId,originalPath,
            questionJson,sourcePaths,slotScope,fingerprint,state,attempts,updatedAt)
            VALUES(?,?,?,?,?,?,?,?,?,'review',0,?)''',
            (q['id'], q['qid'], q['figKey'], q['paperId'], str(original), json.dumps(q, ensure_ascii=False),
             json.dumps([str(p) for p in pages], ensure_ascii=False), scope_text, fingerprint, datetime.now(TZ).isoformat()))
        if q.get('matchStatus')=='source_fallback':
            db.execute("UPDATE jobs SET state='generate' WHERE figureId=?",(q['id'],))
    db.commit()
    return db.execute('SELECT COUNT(*) FROM jobs').fetchone()[0]

def api_allowed(deadline):
    return not (STATE / 'STOP').exists() and window_at()[0] is not None and time.time() < deadline

class ReviewSchemaError(ValueError):
    pass

def parse_review(content):
    if not isinstance(content, str) or not content.strip():
        raise ReviewSchemaError('Empty final content')
    result = json.loads(content)
    if not isinstance(result, dict):
        raise ReviewSchemaError('Expected JSON object')
    scope_key = 'scope_ok' if 'scope_ok' in result else 'scope'
    for key in ('match', 'complete', scope_key, 'uncertain'):
        if not isinstance(result.get(key), bool):
            raise ReviewSchemaError(f'{key}: expected boolean, got {type(result.get(key)).__name__}')
    if not isinstance(result.get('reason'), str):
        raise ReviewSchemaError('reason: expected string')
    if not isinstance(result.get('boxes'), list):
        raise ReviewSchemaError('boxes: expected array')
    result['scope'] = result[scope_key]
    return result

def ask(job, phase, session, deadline, candidate=None):
    import fig_verify as api
    from chongqing_sample_repair import grid_reference
    if not api_allowed(deadline):
        raise InterruptedError('Outside API window or manually stopped')
    pages = [Path(p) for p in json.loads(job['sourcePaths'])]
    work = STATE / 'candidates' / str(job['figureId'])
    work.mkdir(parents=True, exist_ok=True)
    prompt = ('原卷和坐标网格成对提供，标有sourcePage序号；最后一张为已有裁剪或候选图。'
              '只处理以下明确图槽，不因同题其他槽位而要求本槽重复包含所有图。'
              '保留原卷作图状态，不生成、不补画。若范围不明确、文字无法辨认或找不到图，uncertain=true。'
              '组合图允许多矩形裁剪，分别保留图号、单位、标记并保持相对位置。'
              '目标：'+job['slotScope']+'。题目：'+json.loads(job['questionJson'])['stem'][:3000]+
              '。scope_ok专指裁剪范围是否适当，只能是JSON布尔true或false，不能是文字。'
              '严格按下面完整JSON示例输出，所有字段必须存在：'
              '{"match":false,"complete":false,"scope_ok":false,"uncertain":true,"reason":"无法确认","boxes":[]}。'
              'match、complete、scope_ok、uncertain必须为JSON布尔值，reason为字符串，boxes为数组。'
              '每项为{"sourcePage":1,"box":[x0,y0,x1,y1]}，坐标0到1，无法确定则空数组。'
              '网格仅辅助定位，不属于原卷，不要裁剪网格图。')
    parts = [{'type': 'text', 'text': prompt}]
    for i,p in enumerate(pages,1):
        grid = work / f'grid_{i}_{hashlib.sha256(p.read_bytes()).hexdigest()[:12]}.png'
        if not grid.exists():
            grid_reference(p,grid)
        parts.extend([{'type':'text','text':f'sourcePage {i} 原卷'},api.img_part(p,2200),
                      {'type':'text','text':f'sourcePage {i} 网格'},api.img_part(grid,2200)])
    parts.extend([{'type':'text','text':'待检查裁剪图'},api.img_part(Path(candidate or job['originalPath']),1600)])
    if not api_allowed(deadline):
        raise InterruptedError('Outside API window or manually stopped')
    start = time.monotonic()
    response = api.requests.post(api.BASE_URL+'/chat/completions',headers={'Authorization':'Bearer '+api.API_KEY},
        json={'model':api.MODEL,'thinking':{'type':'disabled'},'response_format':{'type':'json_object'},
              'max_tokens':2048,'messages':[{'role':'user','content':parts}]},
        timeout=max(1,min(120,int(deadline-time.time()))))
    data = response.json()
    usage = data.get('usage',{})
    with db_open() as db:
        db.execute('INSERT INTO calls(session,figureId,phase,httpStatus,promptTokens,completionTokens,elapsed,outcome,createdAt) VALUES(?,?,?,?,?,?,?,?,?)',
            (session,job['figureId'],phase,response.status_code,usage.get('prompt_tokens',0),usage.get('completion_tokens',0),
             time.monotonic()-start,'received',datetime.now(TZ).isoformat()))
    response.raise_for_status()
    choice = data.get('choices', [{}])[0]
    content = choice.get('message', {}).get('content')
    diagnostic = {'session': session, 'figureId': job['figureId'], 'phase': phase,
                  'httpStatus': response.status_code, 'finishReason': choice.get('finish_reason'),
                  'content': content, 'usage': usage}
    try:
        result = parse_review(content)
    except (ValueError, TypeError) as exc:
        diagnostic['error'] = type(exc).__name__
        diagnostic['detail'] = str(exc)
        with db_open() as db:
            db.execute("UPDATE calls SET outcome=? WHERE id=(SELECT MAX(id) FROM calls WHERE session=? AND figureId=?)",
                       ('response_parse_failed', session, job['figureId']))
        raise
    finally:
        folder = STATE / 'diagnostics'
        folder.mkdir(exist_ok=True)
        with (folder / 'responses.jsonl').open('a') as log:
            log.write(json.dumps(diagnostic, ensure_ascii=False) + '\n')
    return result


def candidate(job, result):
    from PIL import Image
    import numpy as np
    from source_figure_review import valid_box
    boxes=result.get('boxes') or []
    pages=[Path(p) for p in json.loads(job['sourcePaths'])]
    if not boxes or len(boxes)>8:
        raise ValueError('Missing/too many boxes; needs manual localization')
    images=[]; provenance=[]
    for item in boxes:
        index=item.get('sourcePage');box=item.get('box')
        if not isinstance(index,int) or isinstance(index,bool) or not 1<=index<=len(pages) or not valid_box(box):
            raise ValueError('Invalid source page or box')
        with Image.open(pages[index-1]) as source:
            w,h=source.size
            px=[int(box[0]*w),int(box[1]*h),min(w,int(box[2]*w)+1),min(h,int(box[3]*h)+1)]
            part=source.crop(px).convert('RGB');images.append((index,px,part))
            gray=np.asarray(part.convert('L'));ink=gray<float(np.percentile(gray,70))-55
            edge=[float(ink[:2].mean()),float(ink[-2:].mean()),float(ink[:,:2].mean()),float(ink[:,-2:].mean())]
            provenance.append({'sourcePage':index,'box':box,'pixelBox':px,'edgeInkFraction':edge,'boundaryWarning':any(v>.15 for v in edge)})
    # Preserve geometry for subfigures from the same page. Cross-page composites need manual layout.
    if len({i for i,_,_ in images})!=1:
        raise ValueError('Cross-page composite requires manual layout')
    left=min(p[0] for _,p,_ in images);top=min(p[1] for _,p,_ in images)
    right=max(p[2] for _,p,_ in images);bottom=max(p[3] for _,p,_ in images)
    canvas=Image.new('RGB',(right-left+12,bottom-top+12),'white')
    for _,px,image in images:
        canvas.paste(image,(px[0]-left+6,px[1]-top+6))
    dest=STATE/'candidates'/str(job['figureId'])/'candidate.png';dest.parent.mkdir(parents=True,exist_ok=True);canvas.save(dest)
    return str(dest),provenance

def export_report():
    import html
    with db_open() as db:
        rows=db.execute('SELECT * FROM jobs ORDER BY paperId,figureId').fetchall()
        statuses=dict(db.execute('SELECT state,COUNT(*) FROM jobs GROUP BY state'))
        usage=db.execute('SELECT COUNT(*),COALESCE(SUM(promptTokens),0),COALESCE(SUM(completionTokens),0) FROM calls').fetchone()
    human_confirmed=0
    changed=0
    with sqlite3.connect(f'file:{ROOT}/question-bank/physics.db?mode=ro',uri=True) as production:
        if production.execute("SELECT 1 FROM sqlite_master WHERE name='figure_human_status'").fetchone():
            human_confirmed=production.execute("SELECT COUNT(*) FROM figure_human_status WHERE status='confirmed'").fetchone()[0]
            changed=production.execute("SELECT COUNT(DISTINCT figureId) FROM figure_human_versions").fetchone()[0]
    report={'stage':'chongqing_remaining','queue':statuses,'total':len(rows),'requests':usage[0],
            'promptTokens':usage[1],'completionTokens':usage[2],'productionImagesChanged':changed,'humanConfirmedFigures':human_confirmed,
            'updatedAt':datetime.now(TZ).isoformat()}
    (STATE/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    cards=[]
    for r in rows:
        cards.append('<article><h2>'+html.escape(r['qid']+'/fig'+str(r['figKey']))+'</h2><p>'+html.escape(r['state'])+'</p><p>'+html.escape(r['slotScope'])+'</p><div><img src="'+html.escape(Path(r['originalPath']).as_uri())+'">'+
                     ('<img src="'+html.escape(Path(r['candidatePath']).as_uri())+'">' if r['candidatePath'] else '')+'</div><pre>'+html.escape(r['review'] or '')+'</pre></article>')
    (STATE/'review.html').write_text('<!doctype html><meta charset="utf-8"><title>重庆候选审核队列</title><style>body{font:16px sans-serif;margin:24px}article{border-bottom:1px solid #ddd;padding:20px}div{display:flex;gap:20px}img{max-width:45%;max-height:420px}pre{white-space:pre-wrap}</style>'+''.join(cards))
    return report

def worker(session, deadline):
    seed();db=db_open()
    # A full-source fallback can never become an accepted crop, even if the model says pass.
    for row in db.execute("SELECT * FROM jobs WHERE candidatePath IS NULL AND state='awaiting_visual_acceptance'").fetchall():
        job=dict(row)
        if json.loads(job['questionJson']).get('matchStatus')!='source_fallback':continue
        try:
            result=json.loads(job['review'] or '{}')
            path,checks=candidate(job,result)
            db.execute("UPDATE jobs SET state='review',candidatePath=?,sourceBoxes=?,localChecks=? WHERE figureId=?",(path,json.dumps(result['boxes']),json.dumps(checks),job['figureId']))
        except (ValueError,KeyError,OSError):
            db.execute("UPDATE jobs SET state='needs_manual_repair' WHERE figureId=?",(job['figureId'],))
    db.commit()
    # Noon prioritizes review; night creates candidates then reviews them.
    attempted=set()
    while api_allowed(deadline):
        phase,_=window_at()
        states=('review','generate') if phase=='noon' else ('generate','review')
        row=None
        for state in states:
            if phase=='noon' and state=='generate':
                continue
            rows=db.execute('SELECT * FROM jobs WHERE state=? AND attempts<2 ORDER BY figureId',(state,)).fetchall()
            row=next((r for r in rows if (r['figureId'],state) not in attempted),None)
            if row:break
        if row is None:break
        job=dict(row);kind=job['state'];attempted.add((job['figureId'],kind))
        try:
            result=ask(job,kind,session,deadline,job.get('candidatePath') if kind=='review' else None)
            if kind=='generate':
                if result['uncertain']:raise ValueError('Ambiguous slot/source')
                path,checks=candidate(job,result)
                db.execute("UPDATE jobs SET state='review',candidatePath=?,sourceBoxes=?,localChecks=?,review=?,attempts=0,updatedAt=? WHERE figureId=?",
                           (path,json.dumps(result['boxes']),json.dumps(checks),json.dumps(result,ensure_ascii=False),datetime.now(TZ).isoformat(),job['figureId']))
            else:
                passed=all(result[k] for k in ('match','complete','scope')) and not result['uncertain']
                if json.loads(job['questionJson']).get('matchStatus')=='source_fallback' and not job.get('candidatePath'):passed=False
                db.execute('UPDATE jobs SET state=?,review=?,updatedAt=? WHERE figureId=?',
                    ('awaiting_visual_acceptance' if passed else 'needs_manual_repair' if job.get('candidatePath') or result['uncertain'] else 'generate',json.dumps(result,ensure_ascii=False),datetime.now(TZ).isoformat(),job['figureId']))
        except InterruptedError:break
        except Exception as exc:
            # Never log credentials or full HTTP bodies.
            count=job['attempts']+1
            db.execute('UPDATE jobs SET state=?,attempts=?,review=?,updatedAt=? WHERE figureId=?',
                       ('needs_manual_repair' if count>=2 else kind,count,json.dumps({'error':type(exc).__name__,'detail':str(exc) if isinstance(exc,(ReviewSchemaError,json.JSONDecodeError)) else 'See response diagnostics'}),datetime.now(TZ).isoformat(),job['figureId']))
        db.commit();print(json.dumps(export_report(),ensure_ascii=False),flush=True)
    export_report()
    # Refresh the selection viewer with unconfirmed candidates, never overwrite production figures.
    subprocess.run([sys.executable,str(ROOT/'_scripts/export_viewer.py')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def supervise(session, deadline, phase):
    STATE.mkdir(parents=True,exist_ok=True)
    with (STATE/'run.lock').open('w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        if not api_allowed(deadline):return
        with (STATE/f'{session}.log').open('a') as log:
            child=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'worker','--session',session,'--deadline',str(deadline)],
                stdout=log,stderr=log,start_new_session=True)
            with db_open() as db:
                db.execute('INSERT OR REPLACE INTO runs VALUES(?,?,?,?,?,?,?,NULL)',
                    (session,phase,'running',datetime.fromtimestamp(deadline,TZ).isoformat(),os.getpid(),child.pid,datetime.now(TZ).isoformat()))
            while child.poll() is None and api_allowed(deadline):time.sleep(.5)
            stopped=child.poll() is None
            if stopped:
                os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=3)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            state='manual_stopped' if (STATE/'STOP').exists() else 'deadline_stopped' if stopped else 'completed' if child.returncode==0 else 'failed'
            with db_open() as db:db.execute('UPDATE runs SET state=?,endedAt=? WHERE session=?',(state,datetime.now(TZ).isoformat(),session))
            export_report()

def launch():
    phase,end=window_at()
    if (STATE/'STOP').exists():raise SystemExit('Manually stopped: future scheduled windows disabled')
    if not phase:raise SystemExit('Outside allowed API window')
    session=datetime.now(TZ).strftime('%Y%m%d_%H%M%S')+'_'+phase
    STATE.mkdir(parents=True,exist_ok=True)
    with (STATE/'supervisor.log').open('a') as log:
        child=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'supervise','--session',session,'--deadline',str(end.timestamp()),'--phase',phase],
            stdout=log,stderr=log,start_new_session=True)
        subprocess.Popen(['/usr/bin/caffeinate','-i','-s','-w',str(child.pid)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    print(json.dumps({'scheduledWindow':phase,'deadline':end.isoformat(),'supervisorPid':child.pid}))

def main():
    ap=argparse.ArgumentParser();ap.add_argument('command',choices=['prepare','launch','supervise','worker','stop','status'])
    ap.add_argument('--session');ap.add_argument('--deadline',type=float);ap.add_argument('--phase');a=ap.parse_args()
    if a.command=='prepare':print('queued',seed());print(json.dumps(export_report(),ensure_ascii=False))
    elif a.command=='launch':launch()
    elif a.command=='supervise':supervise(a.session,a.deadline,a.phase)
    elif a.command=='worker':worker(a.session,a.deadline)
    elif a.command=='stop':
        STATE.mkdir(parents=True,exist_ok=True);(STATE/'STOP').write_text('Manual stop; do not auto-resume\n')
        print('Persistent stop saved; active workers stop within approximately 4 seconds')
    else:
        report=export_report()
        with db_open() as db:report['runs']=[dict(r) for r in db.execute('SELECT * FROM runs ORDER BY startedAt DESC LIMIT 6')]
        report['manuallyStopped']=(STATE/'STOP').exists();print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
