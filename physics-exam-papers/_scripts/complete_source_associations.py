"""Locally process the 316 remaining sources. No API or existing figure changes."""
import fcntl,io,json,os,re,shutil,sqlite3,subprocess,time,signal
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from PIL import Image
import source_association_tasks as b
ROOT,BANK,STATE=b.ROOT,b.BANK,b.STATE

def command(args,timeout=180):
 font_config=STATE/'fonts.conf'
 if not font_config.exists():shutil.copyfile(Path(__file__).with_name('source-fonts.conf'),font_config)
 env=dict(os.environ);env['FONTCONFIG_FILE']=str(font_config)
 process=subprocess.Popen(list(map(str,args)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,env=env,start_new_session=True)
 started=time.monotonic()
 while True:
  if (STATE/'STOP').exists() or time.monotonic()-started>timeout:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.communicate(timeout=3)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.communicate()
   raise RuntimeError('Stopped by request' if (STATE/'STOP').exists() else 'Conversion timed out')
  try:out,error=process.communicate(timeout=1);break
  except subprocess.TimeoutExpired:continue
 if process.returncode:raise RuntimeError((error or out)[-1000:])
 return out

def picture(path,origin,source_order):
 with Image.open(path) as im:im.verify()
 with Image.open(path) as im:w,h=im.size
 return {'file':path,'origin':origin,'sourceOrder':source_order,'width':w,'height':h,'sha256':b.digest(path)}

def convert(path,folder):
 sha=b.digest(path);out=folder/'documents'/(sha+'-cjk-v1');out.mkdir(parents=True,exist_ok=True)
 original=out/('original'+path.suffix.lower())
 if not original.exists():shutil.copyfile(path,original)
 origin=str(path.relative_to(ROOT));pages=[]
 if path.suffix.lower()=='.docx':
  with ZipFile(path) as z:
   xml=ET.fromstring(z.read('word/document.xml'))
   if not ''.join(e.text or '' for e in xml.iter() if e.tag.endswith('}t')).strip():
    rels={e.get('Id'):e.get('Target') for e in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
    for e in xml.iter():
     if not e.tag.endswith('}blip'):continue
     rid=e.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
     if rid not in rels:continue
     member='word/'+rels[rid]
     if '..' in Path(member).parts:raise ValueError('Invalid embedded image path')
     data=z.read(member)
     with Image.open(io.BytesIO(data)) as im:w,h=im.size
     if min(w,h)<450:continue
     dest=out/('embedded-'+str(len(pages)+1)+Path(member).suffix);dest.write_bytes(data)
     pages.append(picture(dest,origin+'#'+member,len(pages)+1))
    if pages:return pages,{'original':str(original.relative_to(BANK)),'sha256':sha,'method':'embedded-scans'}
 pdf=original if path.suffix.lower()=='.pdf' else out/'original.pdf'
 if not pdf.exists():command(['soffice','-env:UserInstallation='+(STATE/'lo-profile').resolve().as_uri(),'--headless','--convert-to','pdf','--outdir',out,original])
 if not pdf.exists():raise RuntimeError('Conversion produced no PDF')
 info=command(['pdfinfo',pdf]);match=re.search(r'^Pages:\s+(\d+)',info,re.M)
 if not match or not 1<=int(match[1])<=120:raise RuntimeError('Unexpected PDF page count')
 n=int(match[1])
 if len(list(out.glob('page-*.png')))!=n:command(['pdftoppm','-scale-to','1800','-png',pdf,out/'page'],600)
 files=sorted(out.glob('page-*.png'),key=lambda f:int(f.stem.split('-')[-1]))
 if len(files)!=n:raise RuntimeError('Page count mismatch')
 return [picture(p,origin,i) for i,p in enumerate(files,1)],{'original':str(original.relative_to(BANK)),'sha256':sha,'method':'pdf-render' if path.suffix.lower()=='.pdf' else 'word-to-pdf'}

def process(pid,group):
 folder=BANK/'sources/completed-pages'/b.hashlib.sha256(pid.encode()).hexdigest()[:24]
 repair=False
 with b.edits.connect() as c:
  existing=c.execute('select * from figure_source_pages where paperId=?',(pid,)).fetchall()
  if existing:
   old_manifest=folder/'manifest.json'
   if old_manifest.exists():
    meta=json.loads(old_manifest.read_text());repair=any(d['method']=='word-to-pdf' for d in meta.get('documents',[])) and meta.get('fontProfileVersion')!='cjk-v1'
   if not repair:return {'state':'already_registered'}
   # Old immutable files and provenance stay available to saved human crops.
   if any(not str(r['imagePath']).startswith(str(folder.relative_to(BANK))+'/') for r in existing):raise RuntimeError('Source rows changed concurrently; refusing repair')
   (folder/'mapping-before-font-fix.json').write_text(json.dumps([dict(r) for r in existing],ensure_ascii=False,indent=2))
 src=(ROOT/(group or '__missing__')).resolve()
 if not src.is_relative_to(ROOT.resolve()) or not src.exists():return {'state':'needs_source_review','reason':'Missing source'}
 files=[src] if src.is_file() else list(src.iterdir());photos=[p for p in files if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.webp'}]
 folder=BANK/'sources/completed-pages'/b.hashlib.sha256(pid.encode()).hexdigest()[:24];folder.mkdir(parents=True,exist_ok=True)
 warnings=[];docs=[];records=[]
 if photos:
  def number(p):
   m=re.match(r'^(\d+)',p.stem)
   if not m:raise ValueError('Ambiguous source order: '+p.name)
   return int(m[1])
  photos.sort(key=lambda p:(number(p),p.name));nums=[number(p) for p in photos]
  if len(set(nums))!=len(nums):return {'state':'needs_page_order_review','reason':'Duplicate source numbers'}
  if nums!=list(range(1,len(nums)+1)):warnings.append('Source numbering has gaps; completeness unverified')
  for p in photos:
   r=picture(p,str(p.relative_to(ROOT)),number(p));records.append(r)
   if min(r['width'],r['height'])<250 or r['height']<400 or not .35<=r['width']/r['height']<=1.25:warnings.append(p.name+': possibly segmented screenshot rather than a full page')
 else:
  documents=sorted(p for p in files if p.is_file() and p.suffix.lower() in {'.pdf','.docx','.doc'})
  if not documents:return {'state':'needs_source_review','reason':'No supported document or image'}
  for doc in documents:
   pages,meta=convert(doc,folder);records.extend(pages);docs.append(meta)
  warnings.append('Converted layout and document scope require visual verification; may include answer pages')
 if not records:return {'state':'needs_source_review','reason':'No usable pages'}
 manifest={'paperId':pid,'fontProfileVersion':'cjk-v1','createdAt':b.stamp(),'questionPageMapping':'unverified','pageNumberMeaning':'source sequence, not necessarily printed page number','warnings':warnings,'documents':docs,'pagePhotos':[]}
 for n,r in enumerate(records,1):
  dest=folder/(r['sha256']+r['file'].suffix.lower())
  if dest.exists():
   if b.digest(dest)!=r['sha256']:raise RuntimeError('Archived page hash mismatch')
  else:shutil.copyfile(r['file'],dest)
  manifest['pagePhotos'].append({'page':n,'path':str(dest.relative_to(BANK)),**{k:v for k,v in r.items() if k!='file'}})
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 with b.edits.connect() as c:
  c.execute('BEGIN IMMEDIATE')
  current=c.execute('select * from figure_source_pages where paperId=?',(pid,)).fetchall()
  if repair:
   if [tuple(r) for r in current]!=[tuple(r) for r in existing]:raise RuntimeError('Source mapping changed concurrently')
   c.execute('delete from figure_source_pages where paperId=?',(pid,))
  elif current:return {'state':'registered_by_other_process'}
  for r in manifest['pagePhotos']:c.execute('insert into figure_source_pages values(?,?,?,?,?)',(pid,r['page'],r['path'],r['sha256'],r['origin']))
 return {'state':'associated_needs_visual_review' if warnings else 'associated','pages':len(records),'warnings':warnings,'manifest':str((folder/'manifest.json').relative_to(BANK)),'fontRepair':repair}

def run():
 STATE.mkdir(parents=True,exist_ok=True)
 with (STATE/'lock').open('w') as lock:
  fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  if (STATE/'STOP').exists():raise RuntimeError('Manually stopped')
  initial=[json.loads(x) for x in (STATE/'20261028_115049-results.jsonl').read_text().splitlines()]
  ids={r['paperId'] for r in initial if r['state'] not in ['registered','already_registered']};assert len(ids)==316
  with sqlite3.connect(b.edits.DB) as c:papers=[r for r in c.execute('select paperId,questionGroup from papers') if r[0] in ids]
  papers.sort(key=lambda r:(next(x['state'] for x in initial if x['paperId']==r[0])=='needs_document_conversion',r[0]))
  session=time.strftime('%Y%m%d_%H%M%S')+'-remaining';baseline=b.unchanged_hash()
  with sqlite3.connect(b.edits.DB) as src,sqlite3.connect(STATE/(session+'-before.db')) as backup:src.backup(backup)
  status={'session':session,'pid':os.getpid(),'state':'running','totalPapers':316,'processed':0,'counts':{},'newPages':0,'modelCalls':0,'startedAt':b.stamp()}
  for pid,group in papers:
   if (STATE/'STOP').exists():status['state']='stopped';break
   status.update(currentPaper=pid,updatedAt=b.stamp());b.save(status)
   try:result=process(pid,group)
   except Exception as e:result={'state':'failed','reason':str(e)}
   with (STATE/(session+'-results.jsonl')).open('a') as log:log.write(json.dumps({'paperId':pid,**result},ensure_ascii=False)+'\n')
   key=result['state'];status['counts'][key]=status['counts'].get(key,0)+1;status['processed']+=1;status['newPages']+=result.get('pages',0);b.save(status)
  else:status['state']='completed'
  status.update(endedAt=b.stamp(),questionAndFigureDataUnchanged=b.unchanged_hash()==baseline);b.save(status);print(json.dumps(status,ensure_ascii=False,indent=2))
if __name__=='__main__':run()
