"""Shared figure discovery, normalization and audit. No model calls."""
import argparse
import hashlib
import json
import re
import sqlite3
from pathlib import Path

PLACEHOLDER = re.compile(r"\{\{fig:\s*(\d+)(?:\s*[:：]([\s\S]*?))?\s*\}\}")
REFERENCE = re.compile(r"图\s*(?:\d+(?:[-－—.]\d+)*[甲乙丙丁]?|[甲乙丙丁]|[一二三四五六七八九十]+)|(?:如|下|上|左|右|附)图|图\s*中|图\s*所示")
ROOT = Path(__file__).resolve().parent.parent

def parsed(value):
    return json.loads(value or '[]') if isinstance(value, str) or value is None else value

def text_fields(q):
    for key in ('stem', 'answerText'):
        if q.get(key):
            yield q[key]
    for option in parsed(q.get('options')):
        if isinstance(option, dict):
            yield option.get('text') or ''
    answer = q.get('answer') or {}
    if answer.get('text'):
        yield answer['text']
    for sub in parsed(q.get('subQuestions')):
        yield from text_fields(sub)

def slots(q):
    return {m.group(1) for text in text_fields(q) for m in PLACEHOLDER.finditer(text)}

def valid_keys(db, qid, bank):
    return {str(key) for key, path in db.execute(
        'SELECT figKey,imagePath FROM figures WHERE qid=?', (qid,))
        if path and (bank / path).is_file()}

def normalize_question(q, existing=()):
    """Preserve existing keys; add conservative reference slots across all fields."""
    used = slots(q) | set(existing)
    labels = {}
    def transform(text, has_figure=False):
        text = PLACEHOLDER.sub(lambda m: '{{fig:%s}}%s' % (
            m.group(1), '（%s）' % m.group(2).strip() if m.group(2) else ''), text or '')
        # Existing placeholders already express this field's figure requirements.
        if PLACEHOLDER.search(text):
            return text
        matches = list(REFERENCE.finditer(text))
        numbered_matches = [m for m in matches if re.fullmatch(
            r'图[\d甲乙丙丁一二三四五六七八九十－—.\-]+', re.sub(r'\s+', '', m.group()))]
        if numbered_matches:
            matches = numbered_matches
        if not matches and not has_figure:
            return text
        if not matches:
            matches = [None]
        inserts = []
        seen = set()
        for match in matches:
            label = re.sub(r'\s+', '', match.group()) if match else '选项配图'
            numbered = bool(re.fullmatch(r'图[\d甲乙丙丁一二三四五六七八九十－—.\-]+', label))
            identity = label if numbered else '__generic__'
            if identity in seen:
                continue
            seen.add(identity)
            key = labels.get(label) if numbered else None
            if key is None:
                key = str(max([int(k) for k in used] + [0]) + 1)
                used.add(key)
                if numbered:
                    labels[label] = key
            inserts.append((match.end() if match else len(text), key, label))
        for pos, key, label in reversed(inserts):
            text = text[:pos] + '{{fig:%s}}（%s）' % (key, label) + text[pos:]
        return text
    def walk(node):
        for key in ('stem', 'answerText'):
            if node.get(key):
                node[key] = transform(node[key])
        options = parsed(node.get('options'))
        for option in options:
            if isinstance(option, dict):
                option['text'] = transform(option.get('text'), option.get('hasFigure', False))
        node['options'] = options
        answer = node.get('answer') or {}
        if answer.get('text'):
            answer['text'] = transform(answer['text'])
        subs = parsed(node.get('subQuestions'))
        for sub in subs:
            walk(sub)
        node['subQuestions'] = subs
    walk(q)
    return q

def audit(db, bank):
    rows = []
    for row in db.execute('SELECT * FROM questions'):
        q = dict(row)
        keys = slots(q)
        valid = valid_keys(db, q['qid'], bank)
        references = any(REFERENCE.search(t) for t in text_fields(q))
        missing = keys - valid
        if missing or references and not valid:
            rows.append({'qid': q['qid'], 'missingKeys': sorted(missing, key=int),
                         'referenceWithoutImage': bool(references and not valid)})
    return {'missingQuestions': len(rows),
            'missingSlots': sum(len(r['missingKeys']) for r in rows), 'questions': rows}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=['normalize', 'audit'])
    ap.add_argument('--db', type=Path, default=ROOT / 'question-bank/physics.db')
    ap.add_argument('--paper')
    ap.add_argument('--output', type=Path)
    args = ap.parse_args()
    db = sqlite3.connect(f'file:{args.db}?mode={"rw" if args.command == "normalize" else "ro"}', uri=True)
    db.row_factory = sqlite3.Row
    if args.command == 'normalize':
        # Recoverable snapshot before modifying existing question text.
        backup = args.db.with_name(args.db.stem + '_before_figure_normalize.db')
        if not backup.exists():
            with sqlite3.connect(backup) as target:
                db.backup(target)
        changed = 0
        sql = 'SELECT * FROM questions' + (' WHERE paperId=?' if args.paper else '')
        for row in db.execute(sql, (args.paper,) if args.paper else ()).fetchall():
            q = normalize_question(dict(row), valid_keys(db, row['qid'], args.db.parent))
            values = (q.get('stem'), json.dumps(q['options'], ensure_ascii=False),
                      json.dumps(q['subQuestions'], ensure_ascii=False), q.get('answerText'))
            old = (row['stem'], row['options'], row['subQuestions'], row['answerText'])
            if values != old:
                body = json.dumps({k: q.get(k) for k in ('stem', 'options', 'subQuestions')}, ensure_ascii=False, sort_keys=True)
                db.execute('UPDATE questions SET stem=?,options=?,subQuestions=?,answerText=?,contentHash=? WHERE qid=?',
                           (*values, hashlib.sha1(body.encode()).hexdigest()[:16], row['qid']))
                changed += 1
        db.commit()
        print(json.dumps({'normalizedQuestions': changed}, ensure_ascii=False))
    report = audit(db, args.db.parent)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != 'questions'}, ensure_ascii=False))
    db.close()

if __name__ == '__main__':
    main()
