"""Windowed DeepSeek parsing of inventory papers without valid questions.
Never replaces populated papers. Immutable source files + page-photo manifests persist.
"""
import argparse
import fcntl
import hashlib
import json
import re
import os
import signal
import shutil
import sqlite3
import subprocess
import sys
import time
import uuid
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from recurring_figure_tasks import window_at

ROOT=Path(__file__).resolve().parent.parent
STATE=ROOT/'_state/recurring_papers'
BANK=ROOT/'question-bank'
PRODUCTION=BANK/'physics.db'
TZ=ZoneInfo('Asia/Shanghai')

class ManagedConnection(sqlite3.Connection):
    def __exit__(self,*args):
        try:return super().__exit__(*args)
        finally:self.close()

def database(path,**kwargs):
    return sqlite3.connect(path,factory=ManagedConnection,**kwargs)

def now():return datetime.now(TZ).isoformat()
def stopped():return (STATE/'STOP').exists() or (ROOT/'_state/recurring_figures/STOP').exists()
def allowed(deadline):return not stopped() and window_at()[0] is not None and time.time()<deadline

def connect():
    STATE.mkdir(parents=True,exist_ok=True)
    c=database(STATE/'queue.db',timeout=30);c.row_factory=sqlite3.Row
    c.executescript('''CREATE TABLE IF NOT EXISTS jobs(paperId TEXT PRIMARY KEY,paperJson TEXT,state TEXT,attempted TEXT DEFAULT '[]',currentSource TEXT,error TEXT,nQuestions INTEGER DEFAULT 0,updatedAt TEXT);
    CREATE TABLE IF NOT EXISTS runs(session TEXT PRIMARY KEY,state TEXT,deadline REAL,controllerPid INTEGER,workerPid INTEGER,startedAt TEXT,endedAt TEXT);
    CREATE TABLE IF NOT EXISTS calls(id INTEGER PRIMARY KEY,session TEXT,paperId TEXT,httpStatus INTEGER,promptTokens INTEGER,completionTokens INTEGER,error TEXT,createdAt TEXT);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,session TEXT,paperId TEXT,state TEXT,nQuestions INTEGER,createdAt TEXT);''')
    return c

def seed():
    inv=json.loads((ROOT/'_state/inventory.json').read_text())
    with database(PRODUCTION) as p:active={r[0] for r in p.execute('SELECT DISTINCT paperId FROM questions')}
    with connect() as c:
        for paper in inv['papers']:
            if paper['paperId'] not in active:
                c.execute("INSERT OR IGNORE INTO jobs(paperId,paperJson,state,updatedAt) VALUES(?,?,'pending',?)",(paper['paperId'],json.dumps(paper,ensure_ascii=False),now()))
    return inv

def status():
    with connect() as c:
        report={'manuallyStopped':stopped(),'queue':dict(c.execute('SELECT state,COUNT(*) FROM jobs GROUP BY state')),
                'runs':[dict(r) for r in c.execute('SELECT * FROM runs ORDER BY startedAt DESC LIMIT 8')],
                'usage':dict(c.execute('SELECT COUNT(*) requests,COALESCE(SUM(promptTokens),0) promptTokens,COALESCE(SUM(completionTokens),0) completionTokens FROM calls').fetchone()),'updatedAt':now()}
    (STATE/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));return report

def available_sources(paper,groups):
    out=[]
    for gid in paper.get('questionGroups',[]):
        name=Path(gid).name
        if '答案' in name and not re.search(r'含.{0,2}答案|及.{0,2}答案|附.{0,2}答案|[与和]答案',name):continue
        src=(ROOT/gid).resolve()
        if not src.is_relative_to(ROOT.resolve()) or not src.exists():continue
        files=[src] if src.is_file() else list(src.iterdir())
        if not any(f.is_file() and f.suffix.lower() in {'.doc','.docx','.pdf','.png','.jpg','.jpeg','.webp','.bmp'} for f in files):continue
        out.append(gid)
    return sorted(out,key=lambda g:({'word':0,'doc':0,'docx':0,'pdf':1,'images':2}.get(groups.get(g,{}).get('format'),3),g))

def archive_sources(paper,selected,api):
    dest=BANK/'sources'/'papers'/hashlib.sha256(paper['paperId'].encode()).hexdigest()[:20]
    dest.mkdir(parents=True,exist_ok=True);manifest={'paperId':paper['paperId'],'selectedSource':selected,'pageMapping':'whole-paper; exact question-page mapping unconfirmed','files':[],'pagePhotos':[]}
    for gid in paper.get('questionGroups',[]):
        src=(ROOT/gid).resolve()
        if not src.is_relative_to(ROOT.resolve()) or not src.exists():continue
        files=[src] if src.is_file() else sorted(src.iterdir())
        for f in files:
            if not f.is_file() or f.name.startswith('.') or f.suffix.lower() not in {'.doc','.docx','.pdf','.png','.jpg','.jpeg','.webp','.bmp'}:continue
            digest=hashlib.sha256(f.read_bytes()).hexdigest();target=dest/(digest+f.suffix.lower())
            if not target.exists():shutil.copyfile(f,target)
            entry={'sourceGroup':gid,'originalPath':str(f.relative_to(ROOT.resolve())),'path':str(target.relative_to(BANK)),'sha256':digest}
            manifest['files'].append(entry)
            if f.suffix.lower() in api.IMG_EXT:manifest['pagePhotos'].append(entry)
            elif f.suffix.lower()=='.pdf':
                folder=dest/('pages_'+digest[:16])
                if not (folder/'complete.json').exists():
                    try:
                        pages=api.pdf_to_images(target,folder)
                        (folder/'complete.json').write_text(json.dumps([p.name for p in pages]))
                    except Exception as exc:
                        entry['renderError']=type(exc).__name__
                        continue
                for name in json.loads((folder/'complete.json').read_text()):
                    photo=folder/name;manifest['pagePhotos'].append({'sourceGroup':gid,'path':str(photo.relative_to(BANK)),'sha256':hashlib.sha256(photo.read_bytes()).hexdigest(),'originalPath':entry['originalPath'],'page':name})
    manifest_path=dest/'manifest.json';tmp=dest/'manifest.tmp';tmp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2));tmp.replace(manifest_path)
    return str(manifest_path.relative_to(BANK)),manifest

def validate(questions):
    if not isinstance(questions,list) or len(questions)<5:raise ValueError('too_few_questions')
    seen=set()
    for q in questions:
        if not isinstance(q,dict) or q.get('number') is None or not str(q.get('number','')).strip() or not isinstance(q.get('stem'),str) or not q.get('stem','').strip():raise ValueError('invalid_question')
        if re.search(r'题干未提供|未提供题干|原题缺失|题干缺失|题目未提供|仅含.{0,4}答案',str(q['stem'])):raise ValueError('missing_original_stem')
        num=str(q['number'])
        if num in seen:raise ValueError('duplicate_question_number')
        seen.add(num)
        if q.get('answer') is not None and not isinstance(q['answer'],dict):raise ValueError('invalid_answer_schema')
        for key in ('options','subQuestions','chapters','topics'):
            if q.get(key) is not None and (not isinstance(q[key],list) or (key!='topics' and any(not isinstance(x,dict) for x in q[key]))):raise ValueError('invalid_'+key)
    return questions

def complete_for_publication(questions,meta):
    planned=meta.get('plannedNumbers')
    actual={str(q['number']) for q in questions}
    return isinstance(planned,list) and len(actual)>=10 and actual=={str(n) for n in planned}

def publish(api,paper,questions,meta,manifest):
    validate(questions)
    # Serialize the check and insert. Populated papers (including human edits) are untouched.
    with database(PRODUCTION,timeout=30) as c:
        c.execute('BEGIN IMMEDIATE')
        if c.execute('SELECT COUNT(*) FROM questions WHERE paperId=?',(paper['paperId'],)).fetchone()[0]:return False
        c.execute('CREATE TABLE IF NOT EXISTS paper_source_manifests(paperId TEXT PRIMARY KEY,manifestPath TEXT,createdAt TEXT)')
        c.execute('INSERT OR REPLACE INTO paper_source_manifests VALUES(?,?,?)',(paper['paperId'],manifest,now()))
        api.save_paper(c,paper,questions,meta)
    return True

def worker(session,deadline):
    import kimi_pipeline as api
    inv=seed();groups={g['groupId']:g for g in inv['groups']}
    original_post=api.requests.post
    current={'pid':None}
    def guarded_post(*args,**kwargs):
        if not allowed(deadline):raise InterruptedError('window_stopped')
        kwargs['timeout']=max(.1,min(float(kwargs.get('timeout',300)),deadline-time.time()))
        try:
            response=original_post(*args,**kwargs)
        except Exception as exc:
            with connect() as c:c.execute('INSERT INTO calls(session,paperId,error,createdAt) VALUES(?,?,?,?)',(session,current['pid'],type(exc).__name__,now()))
            raise
        try:usage=response.json().get('usage',{})
        except Exception:usage={}
        with connect() as c:c.execute('INSERT INTO calls(session,paperId,httpStatus,promptTokens,completionTokens,createdAt) VALUES(?,?,?,?,?,?)',(session,current['pid'],response.status_code,usage.get('prompt_tokens',0),usage.get('completion_tokens',0),now()))
        if response.status_code==400:response._content=b'{}'
        return response
    api.requests.post=guarded_post
    base_chat=api.chat
    def safe_chat(*args,**kwargs):
        kwargs['retries']=1
        result=base_chat(*args,**kwargs)
        try:
            parsed=api.extract_json(result[0])
            if isinstance(parsed,dict) and isinstance(parsed.get('numbers'),list):current['numbers']=[str(n) for n in parsed['numbers']]
        except (ValueError,TypeError):pass
        return result
    api.chat=safe_chat
    while allowed(deadline):
        with connect() as c:row=c.execute("SELECT * FROM jobs WHERE state='pending' ORDER BY paperId LIMIT 1").fetchone()
        if row is None:break
        job=dict(row);paper=json.loads(job['paperJson']);pid=paper['paperId'];current['pid']=pid
        with database(PRODUCTION) as c:already=c.execute('SELECT COUNT(*) FROM questions WHERE paperId=?',(pid,)).fetchone()[0]
        if already:
            with connect() as c:c.execute("UPDATE jobs SET state='already_populated',updatedAt=? WHERE paperId=?",(now(),pid))
            continue
        if '化学' in paper.get('stem','') and not any(k in paper.get('stem','') for k in ['物理','理化','理综']):
            with connect() as c:c.execute("UPDATE jobs SET state='needs_subject_review',error='Source title indicates chemistry; verify subject',updatedAt=? WHERE paperId=?",(now(),pid))
            continue
        attempted=json.loads(job['attempted']);sources=[g for g in available_sources(paper,groups) if g not in attempted]
        if not sources:
            with connect() as c:c.execute("UPDATE jobs SET state='needs_source_review',error='No usable untried question source',updatedAt=? WHERE paperId=?",(now(),pid))
            continue
        current['numbers']=None
        gid=sources[0];work=STATE/'work'/hashlib.sha256((pid+gid).encode()).hexdigest()[:24];work.mkdir(parents=True,exist_ok=True)
        api.STATE=work;api.OCR_DIR=work/'ocr';api.OCR_DIR.mkdir(exist_ok=True)
        # Preserve valid cached extraction; never reuse an old empty structured result.
        for group in [gid]+paper.get('answerGroups',[]):
            old=ROOT/'_state/ocr'/(hashlib.md5(group.encode()).hexdigest()[:10]+'.json');target=api.ocr_cache_path(group)
            if old.exists() and not target.exists():
                try:json.loads(old.read_text());shutil.copyfile(old,target)
                except (ValueError,OSError):pass
        for f in work.rglob('*.json'):
            try:json.loads(f.read_text())
            except (ValueError,OSError):f.rename(f.with_suffix('.invalid_'+uuid.uuid4().hex))
        with connect() as c:c.execute("UPDATE jobs SET state='running',currentSource=?,updatedAt=? WHERE paperId=?",(gid,now(),pid))
        try:
            selected={**paper,'questionGroups':[gid]}
            manifest_path,manifest=archive_sources(paper,gid,api)
            questions,meta=api.structure_paper(selected,groups);validate(questions)
            if current.get('numbers') is not None:meta['plannedNumbers']=current['numbers']
            staged=work/'result.json';staged.write_text(json.dumps({'paper':paper,'questions':questions,'meta':meta,'manifest':manifest_path},ensure_ascii=False,indent=2))
            if not allowed(deadline):raise InterruptedError()
            if not complete_for_publication(questions,meta):state='needs_completeness_review'
            elif not manifest['pagePhotos']:state='needs_page_photos'
            else:state='completed' if publish(api,paper,questions,meta,manifest_path) else 'already_populated'
            attempted.append(gid)
            with connect() as c:c.execute('UPDATE jobs SET state=?,attempted=?,nQuestions=?,error=NULL,updatedAt=? WHERE paperId=?',(state,json.dumps(attempted),len(questions),now(),pid));c.execute('INSERT INTO events(session,paperId,state,nQuestions,createdAt) VALUES(?,?,?,?,?)',(session,pid,state,len(questions),now()))
            if state=='completed' and allowed(deadline):
                subprocess.run([sys.executable,str(ROOT/'_scripts/export_viewer.py')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
        except InterruptedError:break
        except Exception as exc:
            attempted.append(gid);remaining=[g for g in sources if g not in attempted]
            # Error type is sufficient for summary; never log gateway response or credentials.
            with connect() as c:c.execute('UPDATE jobs SET state=?,attempted=?,error=?,updatedAt=? WHERE paperId=?',('pending' if remaining else 'needs_source_review',json.dumps(attempted),('Source text lacks question markers' if '题号标记' in str(exc) else str(exc) if isinstance(exc,ValueError) and re.fullmatch(r'[a-z_]+',str(exc)) else type(exc).__name__),now(),pid))
        status()
    # Existing image pilot is independent; pending human acceptance does not block parsing.
    if allowed(deadline):
        subprocess.run([sys.executable,str(ROOT/'_scripts/export_viewer.py')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    status()

def supervise(session,deadline):
    STATE.mkdir(parents=True,exist_ok=True)
    with (STATE/'run.lock').open('w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:return
        if not allowed(deadline):return
        with connect() as c:c.execute("UPDATE jobs SET state='pending' WHERE state='running'")
        backup=STATE/'physics_before_scheduled_parsing.db'
        if not backup.exists():
            with database(PRODUCTION) as c,database(backup) as b:c.backup(b)
        with (STATE/(session+'.log')).open('a') as log:
            child=subprocess.Popen([sys.executable,__file__,'worker','--session',session,'--deadline',str(deadline)],stdout=log,stderr=log,start_new_session=True)
            with connect() as c:c.execute('INSERT INTO runs VALUES(?,?,?,?,?,?,NULL)',(session,'running',deadline,os.getpid(),child.pid,now()))
            while child.poll() is None and allowed(deadline):time.sleep(.5)
            interrupted=child.poll() is None
            if interrupted:
                os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=3)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
            state='manual_stopped' if stopped() else 'deadline_stopped' if interrupted else 'completed' if child.returncode==0 else 'failed'
            with connect() as c:
                c.execute('UPDATE runs SET state=?,endedAt=? WHERE session=?',(state,now(),session))
                c.execute("UPDATE jobs SET state='pending' WHERE state='running'")
            status()

def launch():
    phase,end=window_at()
    if stopped():raise SystemExit('Manually stopped; do not restart')
    if not phase:raise SystemExit('Outside allowed API window')
    seed();session=datetime.now(TZ).strftime('%Y%m%d_%H%M%S')+'_'+phase
    with (STATE/'supervisor.log').open('a') as log:
        child=subprocess.Popen([sys.executable,__file__,'supervise','--session',session,'--deadline',str(end.timestamp())],stdout=log,stderr=log,start_new_session=True)
    subprocess.Popen(['/usr/bin/caffeinate','-i','-s','-w',str(child.pid)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    print(json.dumps({'session':session,'supervisorPid':child.pid,'deadline':end.isoformat()}))

def stop():
    STATE.mkdir(parents=True,exist_ok=True);(STATE/'STOP').write_text('Manual stop; never automatically clear\n')
    with connect() as c:
        for r in c.execute("SELECT workerPid FROM runs WHERE state='running'"):
            try:os.killpg(r['workerPid'],signal.SIGTERM)
            except ProcessLookupError:pass
    print(json.dumps(status(),ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['prepare','status','launch','supervise','worker','stop']);p.add_argument('--session');p.add_argument('--deadline',type=float);a=p.parse_args()
    if a.command=='prepare':seed();print(json.dumps(status(),ensure_ascii=False,indent=2))
    elif a.command=='status':print(json.dumps(status(),ensure_ascii=False,indent=2))
    elif a.command=='launch':launch()
    elif a.command=='stop':stop()
    elif a.command=='supervise':supervise(a.session,a.deadline)
    else:worker(a.session,a.deadline)
