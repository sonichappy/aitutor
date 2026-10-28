"""One-shot, deadline-controlled image repair with a persistent manual stop flag."""
import argparse
import json
import os
import signal
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / '_scripts'
SESSION = ROOT / '_state/repair_20261012'
START = datetime(2026, 10, 12, 18, tzinfo=ZoneInfo('Asia/Shanghai')).timestamp()
END = datetime(2026, 10, 13, 9, tzinfo=ZoneInfo('Asia/Shanghai')).timestamp()
EXCLUDED = {'重庆-2022-2022重庆'}  # Mixed A/B and repeated numbering: never match across both.
WORKER_SCRIPT = Path(__file__).resolve()

def write_status(**values):
    SESSION.mkdir(parents=True, exist_ok=True)
    p = SESSION / 'status.json'
    current = json.loads(p.read_text()) if p.exists() else {}
    current.update(values, updatedAt=datetime.now(ZoneInfo('Asia/Shanghai')).isoformat())
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(current, ensure_ascii=False, indent=2))
    tmp.replace(p)

def snapshot():
    with sqlite3.connect(f'file:{ROOT}/question-bank/physics.db?mode=ro', uri=True) as db:
        counts = dict(db.execute('SELECT COALESCE(matchStatus,\'unchecked\'),COUNT(*) FROM figures GROUP BY 1'))
        return {'figures': db.execute('SELECT COUNT(*) FROM figures').fetchone()[0],
                'ok': counts.get('ok', 0), 'suspect': counts.get('suspect', 0),
                'unchecked': counts.get('unchecked', 0)}

def run_step(*args):
    if (SESSION / 'STOP').exists() or time.time() >= END:
        raise SystemExit(0)
    write_status(step=' '.join(args), stats=snapshot())
    subprocess.run([sys.executable, *args], cwd=SCRIPTS, check=True)
    write_status(stats=snapshot())

def worker():
    from figure_slots import slots, valid_keys
    baseline = snapshot()
    write_status(state='running', baseline=baseline, stats=baseline,
                 excludedPapers=sorted(EXCLUDED), completedPapers=0, failedPapers=[])
    # Snapshot is created by normalize; only images/text mapping is changed, no new exams.
    run_step('figure_slots.py', 'normalize', '--output', str(SESSION / 'gaps_before.json'))
    with sqlite3.connect(ROOT / 'question-bank/physics.db') as db:
        db.row_factory = sqlite3.Row
        pids = {q['paperId'] for q in db.execute('SELECT * FROM questions')
                if q['paperId'] not in EXCLUDED and
                slots(dict(q)) - valid_keys(db, q['qid'], ROOT / 'question-bank')}
    priority = ['重庆-2022-2022重庆a', '重庆-2022-2022重庆b']
    papers = [p for p in priority if p in pids] + sorted(pids - set(priority))
    write_status(plannedPapers=len(papers))
    failures = []
    for index, pid in enumerate(papers):
        write_status(currentPaper=pid, completedPapers=index)
        try:
            run_step('fig_verify.py', 'fill', '--paper', pid, '--workers', '3')
            run_step('fig_verify.py', 'detect', '--paper', pid, '--workers', '3', '--recheck')
        except subprocess.CalledProcessError as exc:
            failures.append({'paperId': pid, 'exitCode': exc.returncode})
            write_status(failedPapers=failures)
        # Keep browser and missing-slot report current for each completed paper.
        run_step('export_viewer.py')
        write_status(completedPapers=index + 1)
    for _ in range(3):
        run_step('fig_verify.py', 'detect', '--workers', '3', '--recheck')
        if not snapshot()['suspect']:
            break
        run_step('fig_verify.py', 'fix2', '--workers', '3')
    run_step('fig_verify.py', 'detect', '--workers', '3', '--recheck')
    run_step('figure_slots.py', 'audit', '--output', str(SESSION / 'gaps_after.json'))
    run_step('acceptance_report.py')
    run_step('export_viewer.py')
    write_status(state='completed', stats=snapshot())

def controller():
    import fcntl
    SESSION.mkdir(parents=True, exist_ok=True)
    with (SESSION / 'controller.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Controller already running')
        stopped = False
        def stop_signal(*_):
            nonlocal stopped
            stopped = True
        signal.signal(signal.SIGTERM, stop_signal)
        signal.signal(signal.SIGINT, stop_signal)
        if (SESSION / 'STOP').exists():
            return
        write_status(state='scheduled', startsAt=datetime.fromtimestamp(START, ZoneInfo('Asia/Shanghai')).isoformat(),
                     stopsAt=datetime.fromtimestamp(END, ZoneInfo('Asia/Shanghai')).isoformat(), controllerPid=os.getpid())
        while time.time() < START and not stopped and not (SESSION / 'STOP').exists():
            time.sleep(1)
        if stopped or (SESSION / 'STOP').exists() or time.time() >= END:
            write_status(state='cancelled')
            return
        env = dict(os.environ, PIPELINE_PROVIDER='deepseek',
                   FIGURE_EXCLUDE_PAPERS=','.join(EXCLUDED))
        with (SESSION / 'pipeline.log').open('a', buffering=1) as log:
            child = subprocess.Popen([sys.executable, str(WORKER_SCRIPT), 'worker'],
                                     cwd=SCRIPTS, env=env, stdout=log, stderr=log,
                                     start_new_session=True)
            write_status(workerPid=child.pid, processGroup=child.pid)
            while child.poll() is None:
                if stopped or (SESSION / 'STOP').exists() or time.time() >= END:
                    reason = 'deadline' if time.time() >= END else 'manual_stop'
                    write_status(state='stopping', stopReason=reason)
                    os.killpg(child.pid, signal.SIGTERM)
                    try:
                        child.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(child.pid, signal.SIGKILL)
                        child.wait()
                    write_status(state='stopped', stopReason=reason, stats=snapshot())
                    return
                time.sleep(1)
            status = json.loads((SESSION / 'status.json').read_text())
            if status.get('state') != 'completed':
                write_status(state='failed', exitCode=child.returncode, stats=snapshot())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=['controller', 'worker', 'stop', 'status'])
    args = ap.parse_args()
    if args.command == 'stop':
        SESSION.mkdir(parents=True, exist_ok=True)
        (SESSION / 'STOP').write_text('Manual stop requested\n')
        print('Stop flag saved; running process group will stop within approximately 6 seconds.')
    elif args.command == 'status':
        print((SESSION / 'status.json').read_text() if (SESSION / 'status.json').exists() else '{}')
        print(json.dumps(snapshot(), ensure_ascii=False))
    elif args.command == 'worker':
        worker()
    else:
        controller()

if __name__ == '__main__':
    main()
