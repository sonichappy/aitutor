"""One-shot server deployment after a verified upload. No passwords are stored.
Run on the server: python3 finish-upload.py ARCHIVE SIZE SHA256
"""
import sys,pathlib,time,hashlib,subprocess,json,tarfile,os
archive=pathlib.Path(sys.argv[1]);size=int(sys.argv[2]);digest=sys.argv[3]
status=pathlib.Path('/srv/aitutor-deploy-status.json');directory=pathlib.Path('/srv/aitutor-data/physics');compose='/srv/aitutor/deploy/physics'
def report(state,**extra):
 tmp=status.with_suffix('.tmp');tmp.write_text(json.dumps({'state':state,'updated':time.time(),**extra}));tmp.replace(status)
def run(args,**kw):return subprocess.run(args,check=True,**kw)
try:
 report('waiting_for_upload',expectedBytes=size)
 deadline=time.time()+48*3600
 while time.time()<deadline:
  received=archive.stat().st_size if archive.exists() else 0
  report('waiting_for_upload',receivedBytes=received,expectedBytes=size)
  if received==size:break
  if received>size:raise RuntimeError('Archive exceeds expected size')
  time.sleep(30)
 else:raise RuntimeError('Upload timeout; partial archive retained')
 report('verifying_archive')
 h=hashlib.sha256()
 with archive.open('rb') as f:
  for part in iter(lambda:f.read(4*1024*1024),b''):h.update(part)
 if h.hexdigest()!=digest:raise RuntimeError('Archive SHA256 mismatch; not extracting')
 report('extracting')
 # This directory must still be an unused initial-deployment destination.
 if (directory/'_state/family/study.db').exists():raise RuntimeError('Existing learning database found; refusing overwrite')
 directory.mkdir(parents=True,exist_ok=True)
 with tarfile.open(archive) as tar:
  for entry in tar:
   target=(directory/entry.name).resolve()
   if not target.is_relative_to(directory.resolve()) or not entry.isfile():raise RuntimeError('Invalid archive member')
   tar.extract(entry,directory,filter='data')
 run(['chown','-R','1000:1000',str(directory)])
 os.chmod(directory/'_state/family/study.db',0o600)
 report('checking_image')
 for _ in range(120):
  result=subprocess.run(['docker','run','--rm','--entrypoint','node','physics-app','-p',"require('next/package.json').version"],capture_output=True,text=True)
  if result.returncode==0 and result.stdout.strip()=='15.1.12':break
  time.sleep(15)
 else:raise RuntimeError('Patched image unavailable')
 report('starting')
 run(['docker','compose','up','-d','--no-build'],cwd=compose)
 for _ in range(180):
  result=subprocess.run(['curl','-fsS','--resolve','physicssmallstep.top:443:127.0.0.1','https://physicssmallstep.top/api/physics/bootstrap'],capture_output=True,text=True)
  if result.returncode==0 and json.loads(result.stdout).get('configured'):break
  time.sleep(5)
 else:raise RuntimeError('Application health check failed')
 run(['docker','compose','exec','-T','app','/opt/venv/bin/python','-m','unittest','discover','-s','physics-exam-papers/_scripts','-p','test_family_physics.py'],cwd=compose)
 report('ready',access='https://physicssmallstep.top/physics',alternate='https://www.physicssmallstep.top/physics')
except Exception as e:
 report('failed',error=str(e));raise
