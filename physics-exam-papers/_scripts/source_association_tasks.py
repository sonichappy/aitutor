"""Local, stoppable source-page registration. No models; never edits questions or figures."""
import argparse,fcntl,hashlib,json,os,re,shutil,sqlite3,time
from pathlib import Path
from PIL import Image
import on_demand_figures as edits
ROOT=edits.ROOT;BANK=edits.BANK;STATE=ROOT/'_state/source_associations'
def stamp():return time.strftime('%Y-%m-%d %H:%M:%S')
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def save(data):
 STATE.mkdir(parents=True,exist_ok=True);p=STATE/'status.tmp';p.write_text(json.dumps(data,ensure_ascii=False,indent=2));p.replace(STATE/'status.json')
def unchanged_hash():
 h=hashlib.sha256()
 with sqlite3.connect(edits.DB) as c:
  for table in ['questions','figures','figure_human_status']:
   if not c.execute("select 1 from sqlite_master where name=?",(table,)).fetchone():continue
   for row in c.execute('select * from '+table+' order by 1'):h.update(json.dumps(row,ensure_ascii=False).encode())
 return h.hexdigest()
def register(pid,group):
 with edits.connect() as c:existing=c.execute('select * from figure_source_pages where paperId=?',(pid,)).fetchall()
 if existing:
  return {'state':'already_registered' if all((BANK/r['imagePath']).is_file() and digest(BANK/r['imagePath'])==r['sha256'] for r in existing) else 'existing_source_problem','pages':len(existing)}
 src=(ROOT/(group or '__missing__')).resolve()
 if not src.is_relative_to(ROOT.resolve()) or not src.exists():return {'state':'missing_source'}
 files=[src] if src.is_file() else list(src.iterdir());photos=[p for p in files if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}]
 if not photos:return {'state':'needs_document_conversion' if any(p.suffix.lower() in {'.doc','.docx','.pdf'} for p in files) else 'needs_source_review'}
 if any(not p.stem.isdigit() for p in photos):return {'state':'needs_page_order_review','reason':'Non-numeric page filenames'}
 photos.sort(key=lambda p:int(p.stem));nums=[int(p.stem) for p in photos]
 if nums!=list(range(nums[0],nums[0]+len(nums))) or nums[0] not in [0,1]:return {'state':'needs_page_order_review','reason':'Page numbers duplicate, gapped or not starting at 0/1'}
 records=[];folder=BANK/'sources/registered-pages'/hashlib.sha256(pid.encode()).hexdigest()[:24]
 for n,path in enumerate(photos,1):
  if not path.resolve().is_relative_to(ROOT.resolve()):raise ValueError('Source outside root')
  with Image.open(path) as im:im.verify()
  with Image.open(path) as im:w,h=im.size
  if min(w,h)<250 or h<400 or not .35<=w/h<=1.25:return {'state':'needs_page_content_review','reason':f'{path.name}: {w}x{h} requires full-page verification'}
  sha=digest(path);dest=folder/(sha+path.suffix.lower());records.append({'page':n,'imagePath':str(dest.relative_to(BANK)),'sha256':sha,'originalPath':str(path.relative_to(ROOT)),'width':w,'height':h,'file':path,'dest':dest})
 if len({r['sha256'] for r in records})!=len(records):return {'state':'needs_page_content_review','reason':'Duplicate page image contents'}
 folder.mkdir(parents=True,exist_ok=True)
 for r in records:
  if r['dest'].exists():
   if digest(r['dest'])!=r['sha256']:raise ValueError('Archived source hash mismatch')
  else:
   tmp=r['dest'].with_suffix(r['dest'].suffix+'.tmp');shutil.copyfile(r['file'],tmp)
   if digest(tmp)!=r['sha256']:raise ValueError('Source changed during copying')
   tmp.replace(r['dest'])
 manifest={'paperId':pid,'method':'existing-numeric-pages','createdAt':stamp(),'questionPageMapping':'unverified','contentReview':'unverified; source pages may include answers','pagePhotos':[{k:v for k,v in r.items() if k not in ['file','dest']} for r in records]}
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 with edits.connect() as c:
  c.execute('BEGIN IMMEDIATE')
  if c.execute('select 1 from figure_source_pages where paperId=?',(pid,)).fetchone():return {'state':'registered_by_other_process'}
  for r in records:c.execute('insert into figure_source_pages values(?,?,?,?,?)',(pid,r['page'],r['imagePath'],r['sha256'],str(r['file'])))
 return {'state':'registered','pages':len(records),'manifest':str((folder/'manifest.json').relative_to(BANK))}
def run():
 STATE.mkdir(parents=True,exist_ok=True)
 with (STATE/'lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if (STATE/'STOP').exists():raise RuntimeError('Manually stopped; STOP must not be cleared automatically')
  session=time.strftime('%Y%m%d_%H%M%S');baseline=unchanged_hash()
  with sqlite3.connect(edits.DB) as c,sqlite3.connect(STATE/(session+'-before.db')) as backup:
   c.backup(backup);papers=c.execute('select paperId,questionGroup from papers where paperId in(select distinct paperId from questions) order by paperId').fetchall()
  status={'session':session,'pid':os.getpid(),'state':'running','startedAt':stamp(),'totalPapers':len(papers),'processed':0,'counts':{},'newPages':0,'modelCalls':0}
  for pid,group in papers:
   if (STATE/'STOP').exists():status['state']='stopped';break
   status['currentPaper']=pid;save(status)
   try:result=register(pid,group)
   except Exception as e:result={'state':'failed','reason':str(e)}
   with (STATE/(session+'-results.jsonl')).open('a') as log:log.write(json.dumps({'paperId':pid,**result},ensure_ascii=False)+'\n')
   key=result['state'];status['counts'][key]=status['counts'].get(key,0)+1;status['processed']+=1
   if key=='registered':status['newPages']+=result['pages']
   save(status)
  else:status['state']='completed'
  status.update(endedAt=stamp(),questionAndFigureDataUnchanged=unchanged_hash()==baseline);save(status)
  if not status['questionAndFigureDataUnchanged']:raise RuntimeError('Concurrent question/figure change detected; inspect baseline backup')
  print(json.dumps(status,ensure_ascii=False,indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('action',choices=['run','status','stop']);args=parser.parse_args()
 if args.action=='run':run()
 elif args.action=='stop':
  STATE.mkdir(parents=True,exist_ok=True);(STATE/'STOP').touch();print('STOP requested; current paper finishes atomically, then exits.')
 else:print((STATE/'status.json').read_text() if (STATE/'status.json').exists() else '{"state":"not_started"}')
