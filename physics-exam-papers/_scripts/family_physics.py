"""Private family physics service. JSON stdin/stdout bridge; no model calls."""
import base64, hashlib, hmac, json, os, re, secrets, sqlite3, sys, time
from pathlib import Path
from datetime import datetime,timezone,timedelta
from zoneinfo import ZoneInfo
from contextlib import contextmanager
from contextvars import ContextVar
from urllib.parse import urlencode
ROOT=Path(os.environ.get('PHYSICS_ROOT',str(Path(__file__).resolve().parent.parent)))
BANK=Path(os.environ.get('PHYSICS_BANK_ROOT',str(ROOT/'question-bank')))
DB=BANK/'physics.db'
STUDY=Path(os.environ.get('PHYSICS_FAMILY_DB',str(ROOT/'_state/family/study.db')))
CURRENT_STUDENT=ContextVar('student',default='legacy-student')
CHAPTERS=[('motion','机械运动','八上','速度 = 路程 ÷ 时间；先统一单位。','比较运动快慢要明确参照物；平均速度用总路程除以总时间。'),('sound','声现象','八上','声音由振动产生，传播需要介质。','音调与频率相关，响度与振幅等因素相关，音色用于辨别声源。'),('heat','物态变化','八上','物态变化先判断初态、末态和吸放热。','熔化、汽化、升华吸热；凝固、液化、凝华放热。'),('light','光现象','八上','反射角等于入射角，角度相对法线测量。','先区分直线传播、反射、折射；平面镜成像是等大的虚像。'),('lens','透镜及其应用','八上','凸透镜成像先比较物距与焦距、二倍焦距。','物距大于二倍焦距时成倒立缩小的实像；不要混淆实像和虚像。'),('density','质量与密度','八上','ρ = m / V；同种物质在一定状态下密度相同。','测量密度先选器材，读数注意分度值、单位和误差方向。'),('force','力','八下','力的作用是相互的；力可改变运动状态或形状。','弹力由弹性形变产生，重力方向竖直向下，G = mg。'),('newton','运动和力','八下','物体受平衡力时保持静止或匀速直线运动。','惯性是物体的属性，不说“受到惯性力”；惯性大小与质量有关。'),('pressure','压强','八下','p = F / S；液体压强 p = ρgh。','先明确压力和受力面积；液体深度从液面竖直向下量。'),('buoyancy','浮力','八下','F浮 = ρ液 g V排；V排是排开液体的体积。','先判断物体状态，再比较浮力与重力；浸没时V排等于物体体积。'),('work','功和机械能','八下','W = Fs（力与位移同方向）；P = W / t。','有力还要在力的方向上有位移；机械能变化要结合具体过程分析。'),('machine','简单机械','八下','杠杆平衡：F₁l₁ = F₂l₂；η = W有用 / W总。','力臂是支点到力作用线的垂直距离；滑轮组先数承担物重的绳段。')]
CHAPTERS += [
 ('internal-energy','内能','九全','Q = cmΔt；温度、热量和内能含义不同。','分子热运动与温度有关；做功和热传递都能改变内能。'),
 ('heat-engine','内能的利用','九全','Q放 = mq；效率等于有效利用能量除以总能量。','理解热机能量转化，分析燃料热值和热机效率。'),
 ('circuit','电流和电路','九全','串联电流处处相等；并联干路电流等于支路之和。','先识别电路连接，再判断电表接法和短路。'),
 ('voltage','电压 电阻','九全','串联总电压等于各部分之和；并联各支路电压相等。','电阻是导体的属性；滑动变阻器要一上一下接入。'),
 ('ohm','欧姆定律','九全','I = U / R；使用同一导体对应的电压和电阻。','结合串并联规律分析电流、电压和电阻变化。'),
 ('electric-power','电功率','九全','W = UIt；P = UI；纯电阻发热 Q = I²Rt。','区分额定功率与实际功率，注意电能与功率的单位。'),
 ('home-electricity','生活用电','九全','家庭用电器并联；开关接在火线一侧。','理解保险装置、接地和安全用电原则。'),
 ('magnetism','电与磁','九全','通电导体周围存在磁场。','区分电流磁效应、磁场对电流的作用和电磁感应。'),
 ('information','信息的传递','九全','电磁波能够在真空中传播。','了解电话、广播、电视与网络的信息传递方式。'),
 ('energy','能源与可持续发展','九全','能量守恒；能量转化和转移有方向性。','区分可再生与不可再生能源，理解能源利用与环境的关系。'),
]

class Error(Exception):
 def __init__(self,message,status=400):self.status=status;super().__init__(message)
@contextmanager
def connection(path):
 c=sqlite3.connect(path,timeout=30);c.row_factory=sqlite3.Row
 def belongs(raw,name):
  try:return int(any(isinstance(x,dict) and str(x.get('chapter','')).split('章',1)[-1].strip()==name for x in json.loads(raw or '[]')))
  except (ValueError,TypeError):return 0
 c.create_function('matches_chapter',2,belongs)
 try:
  with c:yield c
 finally:c.close()
def init():
 STUDY.parent.mkdir(parents=True,exist_ok=True)
 with connection(STUDY) as c:c.executescript('''CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,expires REAL,adminUntil REAL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,qid TEXT,chapter TEXT,answer TEXT,correct INTEGER,mode TEXT,created REAL,due REAL);
 CREATE TABLE IF NOT EXISTS drafts(qid TEXT PRIMARY KEY,answer TEXT,updated REAL);
 CREATE TABLE IF NOT EXISTS management_history(id INTEGER PRIMARY KEY,qid TEXT,actor TEXT,action TEXT,detail TEXT,created REAL);
 CREATE TABLE IF NOT EXISTS flags(id INTEGER PRIMARY KEY,qid TEXT,reason TEXT,state TEXT DEFAULT 'open',created REAL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT);
 CREATE TABLE IF NOT EXISTS limits(key TEXT PRIMARY KEY,n INTEGER,until REAL);''')
 with connection(STUDY) as c:
  c.execute('BEGIN IMMEDIATE')
  c.execute("create table if not exists users(id text primary key,username text unique not null,name text not null,password text not null,role text not null,active integer default 1,created real)")
  columns=lambda table:{r['name'] for r in c.execute('pragma table_info('+table+')')}
  if 'userId' not in columns('sessions'):
   c.execute('alter table sessions add column userId text')
   c.execute('delete from sessions') # Old shared sessions must authenticate to an explicit account.
  if 'studentId' not in columns('attempts'):c.execute("alter table attempts add column studentId text not null default 'legacy-student'")
  if 'studentId' not in columns('flags'):c.execute("alter table flags add column studentId text not null default 'legacy-student'")
  c.execute('create index if not exists flags_qid_state on flags(qid,state)')
  c.execute('create index if not exists history_qid_created on management_history(qid,created)')
  if not c.execute("select 1 from config where key='issue_history_migrated'").fetchone():
   for flag in c.execute('select * from flags').fetchall():
    c.execute('insert into management_history(qid,actor,action,detail,created) values(?,?,?,?,?)',(flag['qid'],flag['studentId'],'legacy_issue',json.dumps({'importedIssue':dict(flag),'note':'历史问题导入，原处理时间及处理人未记录'},ensure_ascii=False),flag['created']))
   c.execute("insert into config values('issue_history_migrated','1')")
  if 'studentId' not in columns('drafts'):
   c.execute('alter table drafts rename to drafts_legacy')
   c.execute('create table drafts(studentId text,qid text,answer text,updated real,primary key(studentId,qid))')
   c.execute("insert into drafts select 'legacy-student',qid,answer,updated from drafts_legacy")
  if 'studentId' not in columns('settings'):
   c.execute('alter table settings rename to settings_legacy')
   c.execute('create table settings(studentId text,key text,value text,primary key(studentId,key))')
   c.execute("insert into settings select 'legacy-student',key,value from settings_legacy")
  c.execute('create index if not exists attempts_student on attempts(studentId,qid,id)')
  old=c.execute("select value from config where key='password'").fetchone()
  if old:
   c.execute('insert or ignore into users values(?,?,?,?,?,1,?)',('legacy-student','student','默认学生',old[0],'student',time.time()))
   pin=c.execute("select value from config where key='pin'").fetchone()
   if pin:c.execute('insert or ignore into users values(?,?,?,?,?,1,?)',('maintenance','administrator','维护账号',pin[0],'maintenance',time.time()))

 with connection(STUDY) as c:
  legacy=c.execute("select id from users where id='maintenance' and username in ('maintenance','mainitenance')").fetchone()
  if legacy:
   if c.execute("select 1 from users where username='administrator' and id<>'maintenance'").fetchone():raise Error('administrator 账号名已占用，请先处理账号冲突',409)
   c.execute("update users set username='administrator' where id='maintenance'")

def import_legacy_edits():
 with connection(STUDY) as c:
  c.execute('BEGIN IMMEDIATE')
  if c.execute("select 1 from config where key='legacy_edits_imported'").fetchone():return
  with connection(DB) as bank:
   tables={r[0] for r in bank.execute("select name from sqlite_master where type='table'")}
   if 'figure_human_versions' in tables:
    for row in bank.execute('select v.*,f.qid from figure_human_versions v join figures f on f.id=v.figureId'):
     detail={'legacyVersion':dict(row),'note':'历史配图版本导入，操作人未记录'}
     c.execute('insert into management_history(qid,actor,action,detail,created) values(?,?,?,?,?)',(row['qid'],'历史操作人未记录','legacy_image',json.dumps(detail,ensure_ascii=False),datetime.fromisoformat(row['createdAt']).timestamp()))
   if 'family_question_versions' in tables:
    for row in bank.execute('select * from family_question_versions'):
     c.execute('insert into management_history(qid,actor,action,detail,created) values(?,?,?,?,?)',(row['qid'],'历史操作人未记录','legacy_edit',json.dumps(dict(row),ensure_ascii=False),row['created']))
  c.execute("insert into config values('legacy_edits_imported','1')")

def hash_password(p,salt=None):
 salt=salt or secrets.token_hex(16);return salt+':'+hashlib.pbkdf2_hmac('sha256',p.encode(),salt.encode(),240000).hex()
def matches(p,value):return hmac.compare_digest(hash_password(p,value.split(':')[0]),value)
def authed(token,admin=False):
 with connection(STUDY) as c:r=c.execute('SELECT s.*,u.username,u.name,u.role FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expires>? AND u.active=1',(token,time.time())).fetchone()
 if not r:raise Error('请先登录',401)
 if admin and r['role']!='maintenance':raise Error('需要管理员账号',403)
 return r
def rate_limit(key):
 with connection(STUDY) as c:
  c.execute('BEGIN IMMEDIATE');r=c.execute('select * from limits where key=?',(key,)).fetchone()
  if r and r['until']>time.time() and r['n']>=15:raise Error('尝试次数过多，请稍后再试',429)
  c.execute('insert or replace into limits values(?,?,?)',(key,(r['n']+1) if r and r['until']>time.time() else 1,r['until'] if r and r['until']>time.time() else time.time()+300))
def chapter(key):return next((x for x in CHAPTERS if x[0]==key),None)
def decode(s,default):
 try:return json.loads(s) if isinstance(s,str) else s if s is not None else default
 except (ValueError,TypeError):return default
def asset(path):
 p=(BANK/path).resolve() if path else None
 if not p or not p.is_relative_to(BANK.resolve()) or not p.is_file():return None
 return {'path':str(p.relative_to(BANK.resolve())),'hash':hashlib.sha256(p.read_bytes()).hexdigest()}
def media(a):return '/api/physics/media?'+urlencode(a) if a else None
def revision(q):return hashlib.sha256(json.dumps(dict(q),sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def question(qid):
 with connection(DB) as c:
  r=c.execute('select q.*,p.province,p.city,p.year,p.stem paperName from questions q join papers p using(paperId) where qid=?',(qid,)).fetchone()
  if not r:raise Error('题目不存在',404)
  q=dict(r);q['revision']=revision(r)
  for key in ['options','subQuestions','chapters','topics','blanks','answerBlanks']:q[key]=decode(q.get(key),[])
  q['figures']={}
  for f in c.execute('select * from figures where qid=?',(qid,)):
   a=asset(f['imagePath']);q['figures'][str(f['figKey'])]={**dict(f),'url':media(a),'hash':a['hash'] if a else None,'version':None}
  if c.execute("select 1 from sqlite_master where name='figure_human_status'").fetchone():
   for f in q['figures'].values():
    st=c.execute('select * from figure_human_status where figureId=?',(f['id'],)).fetchone();f['version']=st['version'] if st else None
 with connection(STUDY) as c:
  q['unavailable']=bool(c.execute("select 1 from flags where qid=? and state='open'",(qid,)).fetchone())
  d=c.execute('select answer from drafts where studentId=? and qid=?',(CURRENT_STUDENT.get(),qid)).fetchone();q['draft']=d[0] if d else ''
 return q

def sources(qid):
 q=question(qid);pid=q['paperId']
 import on_demand_figures as edits
 edits.DB=DB;edits.BANK=BANK
 with edits.connect() as c:existing=[dict(r) for r in c.execute('select * from figure_source_pages where paperId=? order by page',(pid,))]
 if not existing:
  with connection(DB) as c:
   p=c.execute('select questionGroup from papers where paperId=?',(pid,)).fetchone();manifest=c.execute('select manifestPath from paper_source_manifests where paperId=?',(pid,)).fetchone() if c.execute("select 1 from sqlite_master where name='paper_source_manifests'").fetchone() else None
  paths=[]
  if manifest:
   mp=(BANK/manifest[0]).resolve()
   if mp.is_relative_to(BANK.resolve()) and mp.is_file():paths=[(BANK/x['path']).resolve() for x in json.loads(mp.read_text()).get('pagePhotos',[])]
  if not paths and p and p[0]:
   src=(ROOT/p[0]).resolve()
   if src.is_relative_to(ROOT.resolve()) and src.exists():
    paths=sorted(x for x in ([src] if src.is_file() else src.iterdir()) if x.suffix.lower() in {'.png','.jpg','.jpeg','.webp'})
    if not paths:
     pdfs=sorted(x for x in ([src] if src.is_file() else src.iterdir()) if x.suffix.lower()=='.pdf')
     if pdfs:
      import kimi_pipeline as pipeline
      folder=BANK/'sources/family'/hashlib.sha256(pid.encode()).hexdigest()[:20]
      folder.mkdir(parents=True,exist_ok=True)
      paths=sorted(folder.glob('page*.png'))
      if not (folder/'complete').exists():paths=pipeline.pdf_to_images(pdfs[0],folder);(folder/'complete').write_text('ok')
  folder=BANK/'sources/family'/hashlib.sha256(pid.encode()).hexdigest()[:20];folder.mkdir(parents=True,exist_ok=True)
  import shutil
  from PIL import Image
  for n,path in enumerate(dict.fromkeys(paths),1):
   if not path.is_relative_to(ROOT.resolve()) or not path.is_file():continue
   try:
    with Image.open(path) as im:im.verify()
   except Exception:continue
   digest=hashlib.sha256(path.read_bytes()).hexdigest();dest=folder/(digest+path.suffix.lower())
   if not dest.exists():shutil.copyfile(path,dest)
   with edits.connect() as c:c.execute('insert or ignore into figure_source_pages values(?,?,?,?,?)',(pid,n,str(dest.relative_to(BANK)),digest,str(path)))
  with edits.connect() as c:existing=[dict(r) for r in c.execute('select * from figure_source_pages where paperId=? order by page',(pid,))]
 return [{'page':s['page'],'path':s['imagePath'],'sha256':s['sha256'],'url':media({'path':s['imagePath'],'hash':s['sha256']})} for s in existing]

def similarity_features(q):
 def clean(text):return re.sub(r'[^\w\u4e00-\u9fff]', '', re.sub(r'\{\{.*?\}\}', '', str(text or '')).lower())
 text=clean(q.get('stem',''))
 # Full prompt (including options/subquestions) identifies exact duplicates, not just shared stems.
 full=clean(str(q.get('stem',''))+json.dumps(decode(q.get('options'),[]),ensure_ascii=False,sort_keys=True)+json.dumps(decode(q.get('subQuestions'),[]),ensure_ascii=False,sort_keys=True))
 chapters=decode(q.get('chapters'),[]);topics=decode(q.get('topics'),[])
 ch={str(x.get('chapter','')).split('章',1)[-1].strip() for x in chapters if isinstance(x,dict)}-{''}
 sections={str(x.get('section','')).strip() for x in chapters if isinstance(x,dict)}-{''}
 topics={str(x).strip() for x in topics if isinstance(x,str)}-{''}
 grams={text[i:i+2] for i in range(len(text)-1)}
 return ch,sections,topics,grams,full

def similar_questions(qid,limit=3):
 source=question(qid);a=similarity_features(source)
 with connection(STUDY) as c:
  seen={r[0] for r in c.execute('select distinct qid from attempts where studentId=?', (CURRENT_STUDENT.get(),))}
  flagged={r[0] for r in c.execute("select distinct qid from flags where state='open'")}
 with connection(DB) as c:
  rows=[dict(r) for r in c.execute("select qid,stem,options,subQuestions,chapters,topics,type,contentHash from questions where qid<>? and answerStatus='official'",(qid,))]
 ranked=[]
 for q in rows:
  if q['qid'] in flagged:continue
  b=similarity_features(q);ch=a[0]&b[0];sec=(a[1]&b[1]) if ch else set();topics=a[2]&b[2]
  if not (ch or sec or topics):continue
  if a[4]==b[4] or (source.get('contentHash') and source['contentHash']==q.get('contentHash')):continue
  overlap=len(a[3]&b[3])/max(1,len(a[3]|b[3]))
  # Near verbatim copies with identical response options are not useful transfer practice.
  if overlap>.92 and decode(source.get('options'),[])==decode(q.get('options'),[]):continue
  same=q['type']==source['type'];strong=bool(sec or topics)
  score=30*len(sec)+20*len(topics)+8*len(ch)+6*same+15*overlap
  reasons=(['同节：'+'、'.join(sorted(sec)[:3])] if sec else [])+(['同知识点：'+'、'.join(sorted(topics)[:3])] if topics else [])
  if not strong:reasons=['同章节：'+'、'.join(sorted(ch)[:3])+'（未匹配到具体知识点）']
  if same:reasons.append('题型相同')
  ranked.append((strong,q['qid'] not in seen,score,q['qid'],b[4],q.get('contentHash'),reasons))
 ranked.sort(key=lambda x:(-int(x[0]),-int(x[1]),-x[2],x[3]))
 selected=[];fingerprints={a[4]};hashes=set()
 for strong,fresh,score,id,fingerprint,digest,reasons in ranked:
  if fingerprint in fingerprints or (digest and digest in hashes):continue
  candidate=question(id)
  # A referenced missing image makes a question unusable; page placeholders remain visible but labeled.
  refs=re.findall(r'\{\{fig:\s*(\d+)',json.dumps([candidate['stem'],candidate['options'],candidate['subQuestions']],ensure_ascii=False))
  if any(not candidate['figures'].get(key,{}).get('url') for key in refs):continue
  pending=any(candidate['figures'][key]['matchStatus']!='human_confirmed' for key in refs)
  selected.append({'question':candidate,'kind':'同知识点练习' if strong else '相关练习','reasons':reasons,'practiced':not fresh,'imageNotice':'配图待人工核对，可追溯原卷修改' if pending else ''})
  fingerprints.add(fingerprint)
  if digest:hashes.add(digest)
  if len(selected)>=limit:break
 return {'sourceQid':qid,'items':selected,'note':'依据已有标签和题干本地匹配；不代表解题方法或难度相同。'}

def bank_summary(c):
 result={key:0 for key in ['total','papers','official','missing','eightOfficial','eightMissing','otherNine','unclassified']}
 names={ch[1] for ch in CHAPTERS if ch[2] in ['八上','八下']}
 for row in c.execute('select chapters,answerStatus from questions'):
  tags=decode(row['chapters'],[]);tags=tags if isinstance(tags,list) else []
  result['total']+=1;official=row['answerStatus']=='official';result['official' if official else 'missing']+=1
  eight=any(isinstance(x,dict) and str(x.get('chapter','')).split('章',1)[-1].strip() in names for x in tags)
  if eight:result['eightOfficial' if official else 'eightMissing']+=1
  elif any(isinstance(x,dict) and x.get('grade')=='九年级全一册' for x in tags):result['otherNine']+=1
  else:result['unclassified']+=1
 result['papers']=c.execute('select count(distinct paperId) from questions').fetchone()[0]
 return result

def ensure_available(qid):
 with connection(STUDY) as c:
  if c.execute("select 1 from flags where qid=? and state='open'",(qid,)).fetchone():raise Error('题目待修复，暂不可练习',409)

def learning_calendar(student,data):
 tz=ZoneInfo('Asia/Shanghai');today=datetime.now(tz).date()
 try:
  start=datetime.strptime(str(data.get('start',today-timedelta(days=6))),'%Y-%m-%d').date()
  end=datetime.strptime(str(data.get('end',today)),'%Y-%m-%d').date()
 except ValueError:raise Error('日期格式不正确')
 if end<start or (end-start).days>366:raise Error('请选择不超过367天的有效日期范围')
 lo=datetime.combine(start,datetime.min.time(),tz).timestamp();hi=datetime.combine(end+timedelta(days=1),datetime.min.time(),tz).timestamp()
 with connection(STUDY) as c:rows=[dict(r) for r in c.execute('select * from attempts where studentId=? and created>=? and created<? order by created,id',(student,lo,hi))]
 days=[]
 for n in range((end-start).days+1):
  date=str(start+timedelta(days=n));items=[r for r in rows if datetime.fromtimestamp(r['created'],tz).date().isoformat()==date];groups={}
  for r in items:
   ch=r['chapter'] or 'unassigned';g=groups.setdefault(ch,{'chapter':ch,'attempts':0,'correct':0});g['attempts']+=1;g['correct']+=r['correct']
  for ch,g in groups.items():g['questions']=len({r['qid'] for r in items if (r['chapter'] or 'unassigned')==ch})
  days.append({'date':date,'attempts':len(items),'questions':len({r['qid'] for r in items}),'correct':sum(r['correct'] for r in items),'chapters':list(groups.values()),'items':items})
 return {'days':days,'start':str(start),'end':str(end)}

def student_summary(c,id):
 attempts=[dict(r) for r in c.execute('select * from attempts where studentId=? order by id desc limit 500',(id,))]
 latest=[dict(r) for r in c.execute('select * from attempts where studentId=? and id in (select max(id) from attempts where studentId=? group by qid)',(id,id))]
 history={r['qid']:dict(r) for r in c.execute('select qid,count(*) attemptCount,sum(correct) correctCount,sum(case when correct=0 then 1 else 0 end) wrongCount,max(case when correct=0 then created end) lastWrongAt from attempts where studentId=? group by qid having wrongCount>0',(id,))}
 wrong=[{**a,**history[a['qid']]} for a in latest if a['qid'] in history]
 blocked={r[0] for r in c.execute("select distinct qid from flags where state='open'")}
 for a in wrong:a['unavailable']=a['qid'] in blocked
 wrong.sort(key=lambda a:(-a['wrongCount'],-a['lastWrongAt'],-a['id']))
 stats=c.execute('select count(*),sum(correct),max(created) from attempts where studentId=?',(id,)).fetchone()
 chapters=[dict(r) for r in c.execute('select chapter,count(*) attempts,sum(correct) correct from attempts where studentId=? group by chapter',(id,))]
 return {'stats':{'practiced':len(latest),'correct':sum(a['correct']==1 for a in latest),'attempts':stats[0],'correctAttempts':stats[1] or 0,'lastActive':stats[2]},'attempts':attempts,'wrong':wrong,'due':sum(a['due']<=time.time() for a in wrong),'chapterStats':chapters}

def _dispatch(method,path,data,token,expected_user=None):
 init();CURRENT_STUDENT.set('legacy-student');name=path[0] if path else 'bootstrap'
 if name=='bootstrap':
  with connection(STUDY) as c:configured=c.execute("select 1 from config where key='password'").fetchone() is not None
  try:
   r=authed(token);logged=True;admin=r['role']=='maintenance'
   user={k:r[k] for k in ['userId','username','name','role']}
  except Error:logged=False;admin=False;user=None
  return {'configured':configured,'logged':logged,'admin':admin,'user':user}
 if name in ['setup','login'] and method=='POST':
  password=str(data.get('password',''));username=str(data.get('username','student')).strip().lower();rate_limit('login')
  with connection(STUDY) as c:
   c.execute('BEGIN IMMEDIATE');r=c.execute("select value from config where key='password'").fetchone()
   if name=='setup':
    if r:raise Error('账号已设置',409)
    pin=str(data.get('pin',''))
    if len(password)<8 or len(pin)<6:raise Error('学生密码至少8位，维护密码至少6位')
    c.execute('insert into config values(?,?)',('password',hash_password(password)));c.execute('insert into config values(?,?)',('pin',hash_password(pin)))
    for id,user,label,pw,role in [('legacy-student','student','默认学生',password,'student'),('maintenance','administrator','维护账号',pin,'maintenance')]:
     c.execute('insert into users values(?,?,?,?,?,1,?)',(id,user,label,hash_password(pw),role,time.time()))
    username='student'
   user=c.execute('select * from users where username=? and active=1',(username,)).fetchone()
   if not user or not matches(password,user['password']):raise Error('账号或密码错误',401)
   t=secrets.token_urlsafe(32);c.execute('insert into sessions(token,expires,adminUntil,userId) values(?,?,?,?)',(hashlib.sha256(t.encode()).hexdigest(),time.time()+30*86400,time.time()+1800 if user['role']=='maintenance' else 0,user['id']))
  return {'ok':True,'_session':t}
 session=authed(token,admin=name in ['edit','crop','confirm','undo','resolve','reopen','issues','management-history','students','student-stats','student-update'])
 if expected_user and expected_user!=session['userId']:raise Error('登录账号已在其他页面切换，请刷新后继续',409)
 CURRENT_STUDENT.set(session['userId'])
 if name in ['draft','attempt','settings','practice-preferences'] and session['role']!='student':raise Error('维护账号不写入学生学习记录',403)
 if name=='students':
  if method=='POST':
   username=str(data.get('username','')).strip().lower();label=str(data.get('name','')).strip()[:40];password=str(data.get('password',''))
   if not re.fullmatch('[a-z0-9][a-z0-9_-]{2,31}',username) or not label or len(password)<8:raise Error('账号需3—32位字母数字或下划线，姓名必填，密码至少8位')
   with connection(STUDY) as c:
    if c.execute('select 1 from users where username=?',(username,)).fetchone():raise Error('账号已存在',409)
    c.execute('insert into users values(?,?,?,?,?,1,?)',(secrets.token_hex(16),username,label,hash_password(password),'student',time.time()))
  with connection(STUDY) as c:
   students=[]
   for r in c.execute("select id,username,name,active from users where role='student' order by created,id").fetchall():
    summary=student_summary(c,r['id']);students.append({**dict(r),'stats':summary['stats'],'wrong':len(summary['wrong']),'due':summary['due'],'chapterStats':summary['chapterStats']})
  return {'students':students}
 if name=='student-stats':
  with connection(STUDY) as c:
   student=c.execute("select id,username,name from users where id=? and role='student'",(str(data.get('studentId','')),)).fetchone()
   if not student:raise Error('学生不存在',404)
   return {'student':dict(student),**student_summary(c,student['id'])}
 if name=='logout' and method=='POST':
  with connection(STUDY) as c:c.execute('delete from sessions where token=?',(token,))
  return {'ok':True,'_logout':True}
 if name=='unlock' and method=='POST':
  authed(token,True)
  return {'ok':True}
 if name=='lock' and method=='POST':
  with connection(STUDY) as c:c.execute('update sessions set adminUntil=0 where token=?',(token,))
  return {'ok':True}
 if name=='media':
  a=asset(str(data.get('path','')))
  if not a or not hmac.compare_digest(a['hash'],str(data.get('hash',''))):raise Error('图片不存在或已变化',404)
  if Path(a['path']).suffix.lower() not in {'.png','.jpg','.jpeg','.webp'}:raise Error('不支持的媒体',400)
  return {'_file':str((BANK/a['path']).resolve())}
 if name=='similar' and session['role']=='student':ensure_available(str(data.get('qid','')))
 if name=='similar':return similar_questions(str(data.get('qid','')),max(1,min(6,int(data.get('limit',3)))))
 if name=='overview':
  with connection(STUDY) as c:
   summary=student_summary(c,CURRENT_STUDENT.get())
   settings={r['key']:r['value'] for r in c.execute('select key,value from settings where studentId=?',(CURRENT_STUDENT.get(),))}
   flags=[dict(r) for r in c.execute("select id,qid,reason from flags where state='open' and (? or studentId=?) order by id desc limit 100",(int(session['role']=='maintenance'),CURRENT_STUDENT.get()))]
  counts=[]
  with connection(DB) as c:
   c.execute('attach database ? as learning',(str(STUDY),))
   bank_stats=bank_summary(c)
   for ch in CHAPTERS:
    count=c.execute("select count(*) from questions where matches_chapter(chapters,?) and answerStatus='official' and not exists(select 1 from learning.flags f where f.qid=questions.qid and f.state='open')",(ch[1],)).fetchone()[0];counts.append({'id':ch[0],'name':ch[1],'book':ch[2],'formula':ch[3],'tip':ch[4],'count':count})
  return {**summary,'bank':bank_stats,'chapters':counts,'settings':settings,'flags':flags}
 if name=='settings' and method=='POST':
  if not chapter(data.get('chapter')) or data.get('book') not in ['八上','八下','九全']:raise Error('无效学习进度')
  with connection(STUDY) as c:
   for k in ['chapter','book']:c.execute('insert or replace into settings values(?,?,?)',(CURRENT_STUDENT.get(),k,data[k] if k=='chapter' else chapter(data['chapter'])[2]))
  return {'ok':True}
 if name=='practice-preferences':
  keys=['province','city','year','practiced','wrong','type']
  if method=='POST':
   result={}
   for key in keys:
    values=data.get(key,[])
    if not isinstance(values,list) or len(values)>100 or any(not isinstance(x,str) or not x or len(x)>100 for x in values):raise Error('筛选偏好格式不正确')
    if key in ['practiced','wrong'] and any(x not in ['yes','no'] for x in values):raise Error('筛选状态不正确')
    if key=='year' and any(not re.fullmatch(r'\d{4}',x) for x in values):raise Error('年份格式不正确')
    result[key]=list(dict.fromkeys(values))
   with connection(STUDY) as c:c.execute('insert or replace into settings values(?,?,?)',(CURRENT_STUDENT.get(),'practiceFilters',json.dumps(result,ensure_ascii=False)))
   return result
  with connection(STUDY) as c:r=c.execute("select value from settings where studentId=? and key='practiceFilters'",(CURRENT_STUDENT.get(),)).fetchone()
  return decode(r[0],{key:[] for key in keys}) if r else {key:[] for key in keys}
 if name=='papers':
  authed(token,True);search=str(data.get('search',''))[:100]
  with connection(DB) as c:return {'items':[dict(r) for r in c.execute("select p.paperId,p.stem,p.province,p.year,count(q.qid) nQuestions from papers p join questions q using(paperId) where p.stem like ? or p.paperId like ? group by p.paperId order by p.year desc,p.paperId",('%'+search+'%','%'+search+'%'))]}
 if name=='questions':
  def selections(key):
   raw=data.get(key,[])
   if isinstance(raw,str):
    raw=raw.strip()
    if raw.startswith('['):
     try:raw=json.loads(raw)
     except ValueError:raise Error('筛选项格式不正确')
    else:raw=[] if raw in ['', 'all'] else [raw]
   if not isinstance(raw,list) or len(raw)>100 or any(not isinstance(x,str) or len(x)>100 for x in raw):raise Error('筛选项格式不正确')
   return list(dict.fromkeys(raw))
  ch=chapter(data.get('chapter'));kw=str(data.get('search','')).strip()[:100];page=max(0,min(int(data.get('page',0)),10000));admin=str(data.get('manage',''))=='1'
  if admin:authed(token,True)
  ids=selections('chapters') if 'chapters' in data else [ch[0]] if ch else []
  if any(not chapter(id) for id in ids):raise Error('请选择有效章节')
  if not admin and not ids:
   if 'chapters' not in data:raise Error('请选择章节')
   ids=[x[0] for x in CHAPTERS]
  selected_chapters=[chapter(id)[1] for id in ids]
  chapter_where='('+' or '.join('matches_chapter(q.chapters,?)' for _ in selected_chapters)+')' if selected_chapters else ''
  where=[chapter_where] if chapter_where else [];args=list(selected_chapters)
  if not admin:where.extend(["q.answerStatus='official'","not exists(select 1 from learning.flags f where f.qid=q.qid and f.state='open')"])
  if data.get('paperId'):where.append('q.paperId=?');args.append(str(data['paperId']))
  if kw:where.append('(q.stem like ? or p.stem like ? or p.province like ? or cast(p.year as text) like ? or q.qid like ?)');args.extend(['%'+kw+'%']*5)
  practiced=selections('practiced');wrong=selections('wrong')
  if any(x not in ['yes','no'] for x in practiced+wrong):raise Error('无效练习或错题筛选')
  for key,column in [('province','p.province'),('city','p.city'),('type','q.type')]:
   values=selections(key)
   if values:where.append(column+' in ('+','.join('?' for _ in values)+')');args.extend(values)
  years=selections('year')
  if any(not re.fullmatch(r'\d{4}',year) for year in years):raise Error('试卷年份必须为四位数字')
  if years:where.append('p.year in ('+','.join('?' for _ in years)+')');args.extend(int(year) for year in years)
  if len(practiced)==1:where.append('coalesce(h.attemptCount,0)'+('>0' if practiced[0]=='yes' else '=0'))
  if len(wrong)==1:where.append('coalesce(h.wrongCount,0)'+('>0' if wrong[0]=='yes' else '=0'))
  # Keep student history predicates in the database, including histories older than 500 attempts.
  query=" from questions q join papers p using(paperId) left join (select qid,count(*) attemptCount,sum(case when correct=0 then 1 else 0 end) wrongCount from learning.attempts where studentId=? group by qid) h on h.qid=q.qid"+(' where '+' and '.join(where) if where else '')
  with connection(DB) as c:
   c.execute('attach database ? as learning',(str(STUDY),))
   params=[CURRENT_STUDENT.get()]+args
   total=c.execute('select count(*)'+query,params).fetchone()[0]
   page=min(page,max(0,(total-1)//8))
   rows=[dict(r) for r in c.execute('select q.qid,coalesce(h.attemptCount,0) attemptCount,coalesce(h.wrongCount,0) wrongCount'+query+' order by q.uid,q.qid limit 8 offset ?',params+[page*8])]
   facets=[dict(r) for r in c.execute("select distinct p.province,p.city,p.year,q.type from questions q join papers p using(paperId) where q.answerStatus='official'"+(' and '+chapter_where if chapter_where else ''),selected_chapters)]
  filters={'regions':[{'province':p,'city':city} for p,city in sorted({(r['province'] or '',r['city'] or '') for r in facets})],'years':sorted({r['year'] for r in facets if r['year']},reverse=True),'types':sorted({r['type'] for r in facets if r['type']})}
  return {'total':total,'page':page,'items':[{**question(r['qid']),'practiceCount':r['attemptCount'],'wrongCount':r['wrongCount']} for r in rows],'filters':filters}
 if name=='question':
  qid=str(data.get('qid',''))
  if session['role']=='student':ensure_available(qid)
  return question(qid)
 if name=='sources':authed(token,True);return {'pages':sources(str(data.get('qid','')))}
 if name=='draft' and method=='POST':
  q=question(str(data.get('qid','')));answer=str(data.get('answer',''))[:10000]
  with connection(STUDY) as c:
   c.execute('insert or replace into drafts values(?,?,?,?)',(CURRENT_STUDENT.get(),q['qid'],answer,time.time()));c.execute("insert or replace into settings values(?,'lastQid',?)",(CURRENT_STUDENT.get(),q['qid']))
  return {'ok':True}
 if name=='attempt' and method=='POST':
  ensure_available(str(data.get('qid','')))
  q=question(str(data.get('qid','')));ch=chapter(data.get('chapter'));answer=str(data.get('answer','')).strip()[:10000]
  if not answer:raise Error('请先作答')
  auto=q['type'] in ['single_choice','multiple_choice'] and q['answerStatus']=='official' and re.fullmatch('[A-E]+',q.get('answerChoice') or '')
  if auto:
   if not re.fullmatch(r'[A-Ea-e\s,、，]+',answer):raise Error('选择题请填写有效选项字母')
   correct=set(re.findall('[A-E]',answer.upper()))==set(q['answerChoice']);mode='automatic'
  else:
   correct=data.get('correct')
   if not isinstance(correct,bool):raise Error('此题请对照答案后自评')
   mode='self'
  with connection(STUDY) as c:
   c.execute('BEGIN IMMEDIATE')
   if c.execute("select 1 from flags where qid=? and state='open'",(q['qid'],)).fetchone():raise Error('题目待修复，暂不可练习',409)
   c.execute('insert into attempts(studentId,qid,chapter,answer,correct,mode,created,due) values(?,?,?,?,?,?,?,?)',(CURRENT_STUDENT.get(),q['qid'],ch[0] if ch else '',answer,int(correct),mode,time.time(),time.time()+(3 if correct else 1)*86400));c.execute('delete from drafts where studentId=? and qid=?',(CURRENT_STUDENT.get(),q['qid']))
  return {'correct':bool(correct),'mode':mode}
 if name=='flag' and method=='POST':
  q=question(str(data.get('qid','')));reason=str(data.get('reason','')).strip()[:1000]
  if not reason:raise Error('请填写问题说明')
  with connection(STUDY) as c:c.execute('insert into flags(studentId,qid,reason,created) values(?,?,?,?)',(CURRENT_STUDENT.get(),q['qid'],reason,time.time()))
  return {'ok':True}
 if name in ['resolve','reopen'] and method=='POST':
  with connection(STUDY) as c:
   row=c.execute('select * from flags where id=?',(data.get('id'),)).fetchone()
   if not row:raise Error('问题不存在',404)
   c.execute('update flags set state=? where id=?',('resolved' if name=='resolve' else 'open',row['id']))
  return {'ok':True}
 if name=='issues':
  state=str(data.get('state','open'));search=str(data.get('search',''))[:100]
  if state not in ['open','resolved']:raise Error('无效状态')
  with connection(STUDY) as c:return {'items':[dict(r) for r in c.execute("select * from flags where state=? and (qid like ? or reason like ?) order by id desc",(state,'%'+search+'%','%'+search+'%'))]}
 if name=='management-history':
  import_legacy_edits()
  search=str(data.get('search',''))[:100];page=max(0,int(data.get('page',0)));where=['(qid like ? or detail like ?)'];args=['%'+search+'%','%'+search+'%']
  for key,op in [('start','>='),('end','<')]:
   if data.get(key):
    try:
     date=datetime.strptime(str(data[key]),'%Y-%m-%d').date()
     if key=='end':date+=timedelta(days=1)
     ts=datetime.combine(date,datetime.min.time(),ZoneInfo('Asia/Shanghai')).timestamp()
    except ValueError:raise Error('日期格式不正确')
    where.append('created'+op+'?');args.append(ts)
  query=' from management_history where '+' and '.join(where)
  with connection(STUDY) as c:
   total=c.execute('select count(*)'+query,args).fetchone()[0]
   return {'total':total,'page':page,'items':[dict(r) for r in c.execute('select *'+query+' order by id desc limit 20 offset ?',args+[page*20])]}
 if name=='learning-calendar':
  student=str(data.get('studentId',CURRENT_STUDENT.get()))
  if student!=CURRENT_STUDENT.get():authed(token,True)
  return learning_calendar(student,data)
 if name=='student-update' and method=='POST':
  with connection(STUDY) as c:
   row=c.execute("select * from users where id=? and role='student'",(data.get('studentId'),)).fetchone()
   if not row:raise Error('学生不存在',404)
   label=str(data.get('name',row['name'])).strip()[:40]
   if not label:raise Error('姓名不能为空')
   password=str(data.get('password',''))
   if password and len(password)<8:raise Error('密码至少8位')
   active=int(bool(data.get('active',row['active'])))
   c.execute('update users set name=?,password=?,active=? where id=?',(label,hash_password(password) if password else row['password'],active,row['id']))
   if password or not active:c.execute('delete from sessions where userId=?',(row['id'],))
  return {'ok':True}
 if name=='edit' and method=='POST':
  q=question(str(data.get('qid','')))
  with connection(DB) as c:
   c.execute('BEGIN IMMEDIATE');row=c.execute('select * from questions where qid=?',(q['qid'],)).fetchone()
   # Compare the same joined representation used by question().
   joined=c.execute('select q.*,p.province,p.city,p.year,p.stem paperName from questions q join papers p using(paperId) where qid=?',(q['qid'],)).fetchone()
   if data.get('revision')!=revision(joined):raise Error('题目已变化，请重新打开',409)
   fields={k:str(data.get(k,q.get(k) or ''))[:30000] for k in ['stem','answerChoice','answerText','analysis']}
   for field in ['options','subQuestions']:
    value=data.get(field,q[field])
    if not isinstance(value,list) or any(not isinstance(x,dict) or not isinstance(x.get('text' if field=='options' else 'stem',''),str) for x in value):raise Error('选项或子题格式不正确')
    fields[field]=value
   if not fields['stem'].strip():raise Error('题干不能为空')
   c.execute('create table if not exists family_question_versions(id text primary key,qid text,beforeJson text,afterJson text,created real)')
   c.execute('insert into family_question_versions values(?,?,?,?,?)',(secrets.token_hex(16),q['qid'],json.dumps(dict(row),ensure_ascii=False),json.dumps(fields,ensure_ascii=False),time.time()))
   c.execute('update questions set stem=?,answerChoice=?,answerText=?,analysis=?,options=?,subQuestions=?,contentHash=? where qid=?',(fields['stem'],fields['answerChoice'],fields['answerText'],fields['analysis'],json.dumps(fields['options'],ensure_ascii=False),json.dumps(fields['subQuestions'],ensure_ascii=False),hashlib.sha1(json.dumps({k:fields[k] for k in ['stem','options','subQuestions']},sort_keys=True).encode()).hexdigest()[:16],q['qid']))
  return question(q['qid'])
 if name in ['crop','confirm','undo'] and method=='POST':
  q=question(str(data.get('qid','')));pages=sources(q['qid']);key=str(data.get('figKey',''))
  if not re.fullmatch(r'\d{1,4}',key):raise Error('图槽必须是数字')
  import on_demand_figures as edits
  edits.DB=DB;edits.BANK=BANK
  f=q['figures'].get(key);created=False
  if not f:
   if name!='crop':raise Error('图槽不存在')
   with edits.connect() as c:
    c.execute("insert or ignore into figures(qid,figKey,imagePath,matchStatus) values(?,?,'','unchecked')",(q['qid'],key));row=c.execute('select * from figures where qid=? and figKey=?',(q['qid'],key)).fetchone();f=dict(row);f['version']=None;created=True
  item={'id':str(f['id']),'allSources':[{'path':p['path'],'page':p['page'],'sha256':p['sha256']} for p in pages],'isFallback':f.get('matchStatus')=='source_fallback'}
  value={**data,'target':'manual' if name=='crop' else 'original','expectedPath':data.get('expectedPath'),'expectedHash':data.get('expectedHash'),'expectedVersion':data.get('expectedVersion')}
  try:edits.apply(item,value,undo=name=='undo')
  except ValueError as e:
   if created:
    with edits.connect() as c:c.execute("delete from figures where id=? and imagePath='' and not exists(select 1 from figure_human_versions where figureId=?)",(f['id'],f['id']))
   raise Error(str(e),409)
  return question(q['qid'])
 raise Error('接口不存在',404)

def dispatch(method,path,data,token,expected_user=None):
 name=path[0] if path else 'bootstrap';before=None;qid=str(data.get('qid',''))
 if method=='POST' and name in ['edit','crop','confirm','undo','flag','resolve','reopen']:
  init();session=authed(token);import_legacy_edits()
  if name in ['resolve','reopen']:
   with connection(STUDY) as c:
    row=c.execute('select qid from flags where id=?',(data.get('id'),)).fetchone()
    if row:qid=row[0]
  if qid:before=question(qid)
 result=_dispatch(method,path,data,token,expected_user)
 if before is not None:
  detail={'request':data,'before':before,'after':question(qid)}
  with connection(STUDY) as c:c.execute('insert into management_history(qid,actor,action,detail,created) values(?,?,?,?,?)',(qid,session['userId'],name,json.dumps(detail,ensure_ascii=False),time.time()))
 return result

def main():
 try:
  request=json.load(sys.stdin);value=dispatch(request['method'],request['path'],request.get('data',{}),request.get('token',''),request.get('expectedUser'));print(json.dumps({'status':200,'data':value},ensure_ascii=False))
 except Error as e:print(json.dumps({'status':e.status,'data':{'error':str(e)}},ensure_ascii=False))
 except Exception as e:print(json.dumps({'status':500,'data':{'error':'服务处理失败，请重试','kind':type(e).__name__}},ensure_ascii=False))
if __name__=='__main__':main()
