"""Create a consistent SQLite-and-assets backup. Run with the app stopped.
Usage: python3 deploy/physics/backup.py /srv/aitutor-data/physics /srv/backups/physics.tar.gz
The command refuses an existing destination. Original pages and edit history are included.
"""
import argparse, pathlib, sqlite3, tarfile, tempfile, os
p=argparse.ArgumentParser(description=__doc__);p.add_argument('data');p.add_argument('output');a=p.parse_args()
root=pathlib.Path(a.data).resolve();out=pathlib.Path(a.output).resolve()
if not (root/'question-bank/physics.db').is_file():p.error('Missing question-bank/physics.db')
if out==root or out.is_relative_to(root):p.error('Output must be outside data directory')
if out.exists():p.error('Output already exists')
out.parent.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as tmp, out.open('xb') as stream:
 os.chmod(out,0o600)
 with tarfile.open(fileobj=stream,mode='w:gz') as archive:
  for source in sorted(root.rglob('*')):
   if source.is_symlink():p.error('Symbolic links must be resolved before backup: '+str(source))
   if not source.is_file() or any(x in source.parts for x in ['_scripts','__pycache__']):continue
   if source.suffix in ['.env','.log'] or source.name.endswith(('-wal','-shm','-journal')):continue
   rel=source.relative_to(root)
   if source.suffix=='.db':
    snapshot=pathlib.Path(tmp)/str(len(list(pathlib.Path(tmp).iterdir())))
    with sqlite3.connect(source) as src,sqlite3.connect(snapshot) as dst:src.backup(dst)
    archive.add(snapshot,arcname=str(rel))
   else:archive.add(source,arcname=str(rel))
print(out)
