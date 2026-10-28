import os
"""Chongqing pilot: immutable sources, transactional human edits and undo. No API calls."""
import hashlib
import json
import math
import shutil
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from PIL import Image
from source_figure_review import PAPERS, source_pages

ROOT = Path(os.environ.get('PHYSICS_ROOT', str(Path(__file__).resolve().parent.parent)))
BANK = ROOT / 'question-bank'
DB = BANK / 'physics.db'

def now():
    return datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()

def connect():
    c = sqlite3.connect(DB, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.executescript('''CREATE TABLE IF NOT EXISTS figure_human_versions(
      version TEXT PRIMARY KEY,figureId INTEGER NOT NULL,action TEXT NOT NULL,
      beforeJson TEXT NOT NULL,afterJson TEXT NOT NULL,sourceJson TEXT NOT NULL,
      previousStatus TEXT,createdAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS figure_human_status(
      figureId INTEGER PRIMARY KEY,version TEXT NOT NULL,status TEXT NOT NULL,
      updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS figure_source_pages(
      paperId TEXT NOT NULL,page INTEGER NOT NULL,imagePath TEXT NOT NULL,
      sha256 TEXT NOT NULL,originalPath TEXT NOT NULL,PRIMARY KEY(paperId,page));''')
    return c

def initialize():
    # Snapshot before introducing human editing; source files are never overwritten.
    backup = BANK / 'physics_before_on_demand.db'
    if not backup.exists():
        with sqlite3.connect(DB) as c, sqlite3.connect(backup) as b:
            c.backup(b)
    with connect() as c:
        for pid, folder in PAPERS.items():
            for p in sorted((ROOT / '其他城市/重庆/2022' / folder).glob('*.png')):
                digest = hashlib.sha256(p.read_bytes()).hexdigest()
                rel = Path('sources') / pid / (p.stem + '_' + digest[:16] + p.suffix)
                dest = BANK / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                if not dest.exists():
                    shutil.copyfile(p, dest)
                c.execute('INSERT OR IGNORE INTO figure_source_pages VALUES(?,?,?,?,?)',
                          (pid, int(p.stem), str(rel), digest, str(p)))


    # Slots missing a crop retain an explicit full-source fallback; never call it a successful crop.
    from figure_slots import slots
    with connect() as c:
        for qrow in c.execute('SELECT * FROM questions WHERE paperId IN (?,?)',tuple(PAPERS)).fetchall():
            q=dict(qrow)
            existing={str(r[0]) for r in c.execute('SELECT figKey FROM figures WHERE qid=?',(q['qid'],))}
            for key in sorted(slots(q)-existing,key=int):
                page=source_pages(q['number'])[0]
                source=c.execute('SELECT imagePath FROM figure_source_pages WHERE paperId=? AND page=?',(q['paperId'],page)).fetchone()
                if source:
                    c.execute('INSERT INTO figures(qid,figKey,label,page,imagePath,note,cropConfidence,matchStatus) VALUES(?,?,?,?,?,?,?,?)',
                              (q['qid'],key,'待裁图槽 '+key,str(page),source[0],'尚无可靠裁图；此处暂示原卷整页，页码为算法推荐，可从本卷其他页重新框选。',0,'source_fallback'))

def enrich(data):
    """Existing model candidates remain visible; all pilot figures are selectable."""
    from review_workbench import asset_into
    by_id = {i['id']: i for i in data['items']}
    with connect() as c:
        for row in c.execute('SELECT f.*,q.paperId,q.number,q.stem,q.options,q.subQuestions,q.answerText FROM figures f JOIN questions q USING(qid) WHERE q.paperId IN (?,?)',tuple(PAPERS)):
            q = dict(row); key = str(q['id'])
            if key not in by_id:
                original = asset_into(data['images'], BANK / q['imagePath'])
                if not original:
                    continue
                sources = [dict(r) for r in c.execute('SELECT * FROM figure_source_pages WHERE paperId=? ORDER BY page',(q['paperId'],))]
                preferred = set(source_pages(q['number']))
                pages = [{'name':f"{r['page']:02d}.png",'asset':asset_into(data['images'],BANK/r['imagePath'])} for r in sources if r['page'] in preferred]
                digest=hashlib.sha256(json.dumps([q,original,pages],sort_keys=True).encode()).hexdigest()
                i={'id':key,'qid':q['qid'],'figKey':q['figKey'],'paper':'重庆 2022 · '+('A 卷' if q['paperId'].endswith('a') else 'B 卷'),
                   'number':q['number'],'scope':'请对照题干、选项和图槽，确认本图范围。','question':q,'original':original,'candidate':None,
                   'sources':pages,'boxes':[],'review':{},'fingerprint':digest}
                data['items'].append(i);by_id[key]=i
            i=by_id[key]
            # Current production image may have been corrected since candidate generation.
            i['original']=asset_into(data['images'],BANK/q['imagePath'])
            i['isFallback']=q['matchStatus']=='source_fallback'
            i['expectedPath']=q['imagePath'];i['expectedHash']=i['original']
            i['allSources']=[{'name':f"{r['page']:02d}.png",'page':r['page'],'path':r['imagePath'],'sha256':r['sha256'],
                             'asset':asset_into(data['images'],BANK/r['imagePath'])} for r in c.execute('SELECT * FROM figure_source_pages WHERE paperId=? ORDER BY page',(q['paperId'],))]
            status=c.execute('SELECT * FROM figure_human_status WHERE figureId=?',(q['id'],)).fetchone()
            i['humanStatus']=dict(status) if status else None
            if status:
                i['fingerprint']=hashlib.sha256((i['fingerprint']+status['version']).encode()).hexdigest()
    data['items'].sort(key=lambda i:(i['paper'],int(i['number']),int(i['figKey'])))
    return data

def validate_box(box):
    if not isinstance(box,list) or len(box)!=4 or any(isinstance(x,bool) or not isinstance(x,(int,float)) or not math.isfinite(x) for x in box):
        raise ValueError('无效裁切坐标')
    if not (0<=box[0]<box[2]<=1 and 0<=box[1]<box[3]<=1):
        raise ValueError('裁切范围越界')
    return box

def apply(item,value,undo=False):
    version=uuid.uuid4().hex
    with connect() as c:
        c.execute('BEGIN IMMEDIATE')
        row=c.execute('SELECT f.*,q.paperId FROM figures f JOIN questions q USING(qid) WHERE f.id=?',(item['id'],)).fetchone()
        if not row:
            raise ValueError('图槽不存在')
        before=dict(row);before.pop('paperId')
        current_path=BANK/(row['imagePath'] or '')
        current_hash=hashlib.sha256(current_path.read_bytes()).hexdigest() if current_path.is_file() else None
        if value.get('expectedPath')!=row['imagePath'] or value.get('expectedHash')!=current_hash:
            raise ValueError('配图已被修改，请刷新后重试')
        prev=c.execute('SELECT * FROM figure_human_status WHERE figureId=?',(item['id'],)).fetchone()
        if value.get('expectedVersion') != (prev['version'] if prev else None):
            raise ValueError('人工确认版本已变化，请刷新后重试')
        provenance={};status='confirmed'
        if undo:
            if not prev or value.get('version')!=prev['version']:
                raise ValueError('版本已变化或没有可恢复的版本')
            old=c.execute('SELECT * FROM figure_human_versions WHERE version=?',(prev['version'],)).fetchone()
            after=json.loads(old['beforeJson']);status=old['previousStatus'] or 'unconfirmed'
            provenance={'restoredFrom':old['version']}
        else:
            if not all(value.get('checks',{}).get(k) is True for k in ('match','complete','scope','readable')):
                raise ValueError('请确认四项检查后保存至题库')
            target=value.get('target');after=before.copy()
            if target=='manual':
                source=next((s for s in item['allSources'] if s['path']==value.get('source')),None)
                if not source:
                    raise ValueError('原卷页面不属于此试卷')
                box=validate_box(value.get('box'))
                path=BANK/source['path']
                if hashlib.sha256(path.read_bytes()).hexdigest()!=source['sha256']:
                    raise ValueError('原卷版本校验失败')
                with Image.open(path) as image:
                    w,h=image.size;rect=(math.floor(box[0]*w),math.floor(box[1]*h),math.ceil(box[2]*w),math.ceil(box[3]*h))
                    if rect[2]-rect[0]<8 or rect[3]-rect[1]<8:
                        raise ValueError('框选区域过小')
                    rel='assets/human_'+version+'.png';image.crop(rect).save(BANK/rel)
                provenance={'source':source,'normalizedBox':box,'pixelBox':rect}
                after['imagePath']=rel;after['page']=str(source['page'])
            elif target=='candidate':
                # Only a candidate supplied by the server can be promoted.
                qdb=sqlite3.connect(ROOT/'_state/recurring_figures/queue.db')
                job=qdb.execute('SELECT candidatePath FROM jobs WHERE figureId=?',(item['id'],)).fetchone();qdb.close()
                path=Path(job[0]) if job and job[0] else None
                if not path or not path.resolve().is_relative_to(ROOT) or hashlib.sha256(path.read_bytes()).hexdigest()!=item.get('candidate'):
                    raise ValueError('候选版本已变化')
                rel='assets/human_'+version+'.png';shutil.copyfile(path,BANK/rel);after['imagePath']=rel
                provenance={'candidatePath':str(path),'sha256':item['candidate'],'archivedSources':item['allSources'],'modelBoxes':item.get('boxes',[])}
            elif target=='original' and not current_path.is_file():
                raise ValueError('当前图槽没有有效图片，请先补图')
            elif target=='original' and item.get('isFallback'):
                raise ValueError('这是原卷整页占位，请框选裁图后确认')
            elif target!='original':
                raise ValueError('无效图片来源')
            after['matchStatus']='human_confirmed';after['cropConfidence']=1.0
            provenance['note']=str(value.get('note',''))[:4000]
        c.execute('INSERT INTO figure_human_versions VALUES(?,?,?,?,?,?,?,?)',(version,int(item['id']),'undo' if undo else value['target'],json.dumps(before),json.dumps(after),json.dumps(provenance,ensure_ascii=False),prev['status'] if prev else None,now()))
        c.execute('UPDATE figures SET imagePath=?,page=?,note=?,cropConfidence=?,matchStatus=? WHERE id=?',
                  (after['imagePath'],after['page'],after['note'],after['cropConfidence'],after['matchStatus'],item['id']))
        c.execute('INSERT OR REPLACE INTO figure_human_status VALUES(?,?,?,?)',(int(item['id']),version,status,now()))
    return {'version':version,'status':status,'imagePath':after['imagePath']}
