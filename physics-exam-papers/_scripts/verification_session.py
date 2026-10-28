"""Review a fixed overnight backlog during the authorized noon window."""
import argparse
import json
import os
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import repair_session as timer

timer.SESSION = timer.ROOT / '_state/verify_20261013_noon'
timer.START = datetime(2026, 10, 13, 12, tzinfo=ZoneInfo('Asia/Shanghai')).timestamp()
timer.END = datetime(2026, 10, 13, 14, tzinfo=ZoneInfo('Asia/Shanghai')).timestamp()
timer.WORKER_SCRIPT = Path(__file__).resolve()

def prepare():
    timer.SESSION.mkdir(parents=True, exist_ok=True)
    manifest = timer.SESSION / 'manifest.json'
    if manifest.exists():
        return json.loads(manifest.read_text())
    bank = timer.ROOT / 'question-bank'
    with sqlite3.connect(f'file:{bank}/physics_before_figure_normalize.db?mode=ro', uri=True) as prior:
        original_pending = {r[0] for r in prior.execute(
            "SELECT id FROM figures WHERE matchStatus IS NULL OR matchStatus='unchecked'")}
    with sqlite3.connect(f'file:{bank}/physics.db?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        rows = [dict(r) for r in db.execute(
            "SELECT id,qid,figKey,imagePath,matchStatus FROM figures "
            "WHERE matchStatus IS NULL OR matchStatus='unchecked' ORDER BY id")
                if r['id'] not in original_pending]
    data = {'createdAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
            'scope': 'Overnight pending; excludes seven already pending before the overnight run',
            'provider': 'deepseek', 'count': len(rows), 'figures': rows}
    manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return data

def worker():
    import fig_verify as verify
    manifest = prepare()
    db = verify.get_db()
    backup = timer.SESSION / 'before_review.db'
    if not backup.exists():
        with sqlite3.connect(backup) as dest:
            db.backup(dest)
    totals = {'processedFigures': 0, 'passed': 0, 'suspect': 0, 'failed': 0,
              'skipped': 0, 'requests': 0, 'promptTokens': 0, 'completionTokens': 0}
    timer.write_status(state='running', plannedFigures=manifest['count'],
                       baseline=timer.snapshot(), **totals)
    local = threading.local()
    post = verify.requests.post
    def measured_post(*args, **kwargs):
        if (timer.SESSION / 'STOP').exists() or time.time() >= timer.END:
            raise RuntimeError('Review session stopped or deadline reached')
        result = post(*args, **kwargs)
        local.requests += 1
        try:
            usage = result.json().get('usage', {})
            local.prompt += usage.get('prompt_tokens', 0)
            local.completion += usage.get('completion_tokens', 0)
        except ValueError:
            pass
        return result
    verify.requests.post = measured_post
    def review(row):
        local.requests = local.prompt = local.completion = 0
        start = time.monotonic()
        try:
            status, reason = verify.verify_one(row, verify.collect_subq_stems(row))
        except Exception as exc:
            status, reason = 'unchecked', type(exc).__name__
        return {'id': row['id'], 'qid': row['qid'], 'figKey': row['figKey'],
                'status': status, 'reason': reason,
                'seconds': round(time.monotonic() - start, 2),
                'requests': local.requests, 'promptTokens': local.prompt,
                'completionTokens': local.completion}
    # Small batches keep manual stop and deadline responsive, with bounded API concurrency.
    with (timer.SESSION / 'results.jsonl').open('a', buffering=1) as log:
        with ThreadPoolExecutor(max_workers=3) as pool:
            for offset in range(0, manifest['count'], 12):
                if (timer.SESSION / 'STOP').exists() or time.time() >= timer.END:
                    return
                futures = []
                for item in manifest['figures'][offset:offset + 12]:
                    row = db.execute('SELECT f.*,q.stem,q.options,q.subQuestions,q.answerText '
                                     'FROM figures f JOIN questions q USING(qid) WHERE f.id=?',
                                     (item['id'],)).fetchone()
                    if row is None or row['matchStatus'] in ('ok', 'suspect'):
                        totals['skipped'] += 1
                        continue
                    futures.append(pool.submit(review, dict(row)))
                for future in as_completed(futures):
                    result = future.result()
                    if result['status'] in ('ok', 'suspect'):
                        db.execute('UPDATE figures SET matchStatus=? WHERE id=?',
                                   (result['status'], result['id']))
                        db.commit()
                    totals['processedFigures'] += 1
                    totals[{'ok': 'passed', 'suspect': 'suspect', 'unchecked': 'failed'}[result['status']]] += 1
                    for key in ('requests', 'promptTokens', 'completionTokens'):
                        totals[key] += result[key]
                    log.write(json.dumps(result, ensure_ascii=False) + '\n')
                    print(json.dumps(result, ensure_ascii=False), flush=True)
                    timer.write_status(currentFigure=result['qid'] + '/fig' + result['figKey'],
                                       stats=timer.snapshot(), **totals)
                if offset % 60 == 0:
                    timer.run_step('export_viewer.py')
    timer.run_step('export_viewer.py')
    timer.write_status(state='completed', stats=timer.snapshot(), **totals)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=['prepare', 'controller', 'worker', 'status', 'stop'])
    args = ap.parse_args()
    if args.command == 'prepare':
        data = prepare()
        print(json.dumps({'plannedFigures': data['count'], 'provider': data['provider']}))
    elif args.command == 'worker':
        worker()
    elif args.command == 'controller':
        timer.controller()
    elif args.command == 'stop':
        timer.SESSION.mkdir(parents=True, exist_ok=True)
        (timer.SESSION / 'STOP').write_text('Manual stop requested\n')
        print('Stop requested; controller stops worker within approximately 6 seconds.')
    else:
        p = timer.SESSION / 'status.json'
        print(p.read_text() if p.exists() else '{}')
        print(json.dumps(timer.snapshot(), ensure_ascii=False))

if __name__ == '__main__':
    main()
