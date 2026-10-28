"""Local Chongqing selection, source tracing, manual crop editing and version recovery."""
import argparse
import base64
import hashlib
import json
import mimetypes
import os
import sqlite3
import threading
from urllib.parse import unquote, urlsplit, parse_qs, quote
import html
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from socketserver import TCPServer
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(os.environ.get('PHYSICS_ROOT', str(Path(__file__).resolve().parent.parent)))
OUT = ROOT / '_state/recurring_figures/workbench'
RECORDS = OUT / 'acceptance.json'
LOCK = threading.Lock()

def load_records():
    return json.loads(RECORDS.read_text()) if RECORDS.exists() else {}

def asset_into(images, value):
    p = Path(value).resolve()
    if not p.is_relative_to(ROOT.resolve()) or not p.is_file():
        return None
    raw = p.read_bytes()
    key = hashlib.sha256(raw).hexdigest()
    images.setdefault(key, 'data:' + (mimetypes.guess_type(p.name)[0] or 'image/png') + ';base64,' + base64.b64encode(raw).decode())
    return key

def build_data():
    images = {}
    asset = lambda value: asset_into(images, value)
    db = sqlite3.connect(f'file:{ROOT}/_state/recurring_figures/queue.db?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    jobs = db.execute("SELECT * FROM jobs WHERE state IN ('awaiting_visual_acceptance','needs_manual_repair') ORDER BY paperId,figureId").fetchall()
    items = []
    for row in jobs:
        r = dict(row)
        q = json.loads(r['questionJson'])
        original = asset(r['originalPath'])
        candidate = asset(r['candidatePath']) if r['candidatePath'] else None
        pages = [{'name': Path(p).name, 'asset': asset(p)} for p in json.loads(r['sourcePaths'])]
        digest = hashlib.sha256(json.dumps([r['fingerprint'], original, candidate, pages], sort_keys=True).encode()).hexdigest()
        items.append({'id': str(r['figureId']), 'qid': r['qid'], 'figKey': r['figKey'],
                      'paper': '重庆 2022 · ' + ('A 卷' if r['paperId'].endswith('a') else 'B 卷'),
                      'number': q['number'], 'scope': r['slotScope'], 'question': q,
                      'original': original, 'candidate': candidate, 'sources': pages,
                      'boxes': json.loads(r['sourceBoxes'] or '[]'),
                      'review': json.loads(r['review'] or '{}'), 'fingerprint': digest})
    from on_demand_figures import enrich
    return enrich({'items': items, 'images': images, 'generatedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat()})

def save_record(item, value):
    if value.get('fingerprint') != item['fingerprint']:
        raise ValueError('图片版本已变化，请刷新后重新验收')
    if value.get('decision') not in ('pending', 'pass', 'repair', 'uncertain'):
        raise ValueError('无效验收结果')
    if value.get('target') not in ('original', 'candidate') or not item.get(value['target']):
        raise ValueError('所选图片不存在')
    note = value.get('note', '')
    if not isinstance(note, str) or len(note) > 4000:
        raise ValueError('备注过长')
    checks = value.get('checks')
    keys = ('match', 'complete', 'scope', 'readable')
    if not isinstance(checks, dict) or any(not isinstance(checks.get(k), bool) for k in keys):
        raise ValueError('验收检查项无效')
    if value['decision'] == 'pass' and not all(checks[k] for k in keys):
        raise ValueError('通过前请确认四项检查均满足')
    record = {k: value[k] for k in ('fingerprint', 'decision', 'target', 'checks')}
    record.update(note=note, qid=item['qid'], figKey=item['figKey'],
                  updatedAt=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat())
    with LOCK:
        data = load_records()
        data[item['id']] = record
        OUT.mkdir(parents=True, exist_ok=True)
        tmp = RECORDS.with_suffix('.tmp')
        with tmp.open('w') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        tmp.replace(RECORDS)
    return record

def serve(port):
    from on_demand_figures import initialize, apply as apply_figure
    initialize()
    data = build_data()
    items = {i['id']: i for i in data['items']}
    template = Path(__file__).with_name('review_workbench.html').read_text()
    payload = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    page = template.replace('__WORKBENCH_DATA__', payload).encode()
    class Handler(BaseHTTPRequestHandler):
        def response(self, status, body, content_type='application/json; charset=utf-8'):
            raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(raw)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(raw)
        def do_GET(self):
            if self.path.split('?')[0] in ('/', '/index.html'):
                return self.response(200, Path(__file__).with_name('review_workbench.html').read_text().replace('__WORKBENCH_DATA__', json.dumps(build_data(), ensure_ascii=False).replace('<', '\\u003c')).encode(), 'text/html; charset=utf-8')
            if self.path.split('?')[0] == '/paper-source':
                pid=parse_qs(urlsplit(self.path).query).get('paperId',[''])[0]
                with sqlite3.connect(ROOT/'question-bank/physics.db') as production:
                    exists=production.execute("SELECT 1 FROM sqlite_master WHERE name='paper_source_manifests'").fetchone()
                    row=production.execute('SELECT manifestPath FROM paper_source_manifests WHERE paperId=?',(pid,)).fetchone() if exists else None
                if not row:return self.response(404,{'error':'尚无归档来源'})
                manifest_path=(ROOT/'question-bank'/row[0]).resolve()
                if not manifest_path.is_relative_to((ROOT/'question-bank/sources').resolve()):return self.response(403,{'error':'无效来源'})
                manifest=json.loads(manifest_path.read_text())
                cards=[]
                for n,p in enumerate(manifest.get('pagePhotos',[]),1):
                    url='/'+quote(p['path']);cards.append('<figure><figcaption>原卷页面 '+str(n)+' · '+html.escape(p.get('sourceGroup',''))+'</figcaption><a href="'+url+'" target="_blank"><img loading="lazy" src="'+url+'" style="max-width:100%;max-height:950px"></a></figure>')
                body='<!doctype html><meta charset="utf-8"><title>原卷追溯</title><main style="max-width:1050px;margin:24px auto;font:16px system-ui"><h1>'+html.escape(pid)+'</h1><p>以下保留本卷完整来源页；题号与页码尚未人工确认。可点击原图放大，后续可据此重新裁切配图。</p>'+''.join(cards)+'</main>'
                return self.response(200,body.encode(),'text/html; charset=utf-8')
            if self.path.split('?')[0] == '/bank':
                viewer=ROOT/'question-bank/题库浏览器.html'
                if (ROOT/'question-bank/physics.db').stat().st_mtime>viewer.stat().st_mtime:
                    import subprocess,sys
                    subprocess.run([sys.executable,str(ROOT/'_scripts/export_viewer.py')],capture_output=True,timeout=30)
                return self.response(200, (ROOT/'question-bank/题库浏览器.html').read_bytes(), 'text/html; charset=utf-8')
            if self.path.startswith(('/assets/','/sources/')):
                p=(ROOT/'question-bank'/unquote(self.path.split('?')[0])[1:]).resolve()
                if (p.is_relative_to((ROOT/'question-bank/assets').resolve()) or p.is_relative_to((ROOT/'question-bank/sources').resolve())) and p.is_file():
                    return self.response(200,p.read_bytes(),mimetypes.guess_type(p.name)[0] or 'application/octet-stream')
            if self.path == '/api/records':
                return self.response(200, load_records())
            return self.response(404, {'error': 'Not found'})
        def do_POST(self):
            if self.path not in ('/api/record','/api/apply','/api/undo'):
                return self.response(404, {'error': 'Not found'})
            # Local UI only, reject cross-site writes and oversized bodies.
            origin = self.headers.get('Origin')
            if origin not in (f'http://127.0.0.1:{port}', f'http://localhost:{port}'):
                return self.response(403, {'error': '仅接受本地验收页面保存'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 16000:
                    raise ValueError('请求大小无效')
                value = json.loads(self.rfile.read(length))
                current_items = {i['id']:i for i in build_data()['items']}
                item = current_items.get(str(value.get('id')))
                if not item:
                    raise ValueError('验收项目不存在')
                if self.path in ('/api/apply','/api/undo'):
                    with LOCK:
                        result=apply_figure(item,value,undo=self.path=='/api/undo')
                        with sqlite3.connect(ROOT/'_state/recurring_figures/queue.db') as queue:
                            queue.execute('UPDATE jobs SET state=? WHERE figureId=?',('human_confirmed' if result['status']=='confirmed' else 'needs_manual_repair',item['id']))
                    import subprocess,sys
                    exported=subprocess.run([sys.executable,str(ROOT/'_scripts/export_viewer.py')],capture_output=True)
                    result['viewerRefreshed']=exported.returncode==0
                    return self.response(200,result)
                return self.response(200, save_record(item, value))
            except (ValueError, TypeError, KeyError) as exc:
                return self.response(400, {'error': str(exc)})
            except OSError:
                return self.response(500, {'error': '保存失败，请导出记录备份'})
        def log_message(self, *args):
            pass
    class LocalServer(ThreadingHTTPServer):
        def server_bind(self):
            # HTTPServer's reverse DNS lookup can stall startup on offline Macs.
            TCPServer.server_bind(self)
            self.server_name = 'localhost'
            self.server_port = self.server_address[1]
    server = LocalServer(('127.0.0.1', port), Handler)
    print(f'http://127.0.0.1:{port} · {len(items)} items', flush=True)
    server.serve_forever()

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=3012)
    args = ap.parse_args()
    serve(args.port)
