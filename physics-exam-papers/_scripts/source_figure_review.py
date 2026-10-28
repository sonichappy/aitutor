"""Source-aware review and bounded recropping trial for Chongqing 2022 A/B."""
import argparse
import hashlib
import json
import math
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image
import fig_verify as api

OUT = api.STATE / 'chongqing_2022_review'
PAPERS = {'重庆-2022-2022重庆a': '2022年重庆中考物理真题A卷（图片版）_图片版',
          '重庆-2022-2022重庆b': '2022年重庆市中考物理真题B卷（图片版）_图片版'}
PROMPT = """你是试卷配图质量审核员。前面的图片是已经确认卷别的原卷页面，最后一张是待审核裁剪图。
题目：{question}
本图槽位所在字段：{target}
现有配图说明（可能错误，不能据此认定正确）：{note}
必须对照原卷，分别判断：match=属于正确题目及所需子图；complete=原卷中本槽需要的图形、数字、单位、坐标轴、连线、甲乙标记均完整；scope=裁剪范围适当，没有其他题目或非目标子图。
单个选项只需它的选项图；主干的组合图须包含全部必要子图。原卷留给学生作图的空白/未连线必须保留，不得要求已填答案，不得生成新图。
若不能明确本槽需求或原图不清晰，标 uncertain，不要猜。不要把题干整段当作插图。
只返回JSON：{{"match":true/false,"complete":true/false,"scope":true/false,"uncertain":true/false,"reason":"具体问题", "sourcePage":原图的图片序号从1开始,"box":[x0,y0,x1,y1]或null}}。
box 是相对于所选原图全页的0到1坐标，完整紧凑地框住本槽所需图片及标记；已合格无需给box；无法可靠修复给null。
"""

def source_pages(number):
    number = int(number)
    page = 1 if number <= 4 else 2 if number <= 8 else 3 if number <= 14 else 4 if number <= 16 else 5 if number <= 18 else 6
    return [page, 5] if number == 16 else [page]

def valid_box(box):
    return (isinstance(box, list) and len(box) == 4 and
            all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in box)
            and 0 <= box[0] < box[2] <= 1 and 0 <= box[1] < box[3] <= 1
            and box[2] - box[0] >= 0.02 and box[3] - box[1] >= 0.02)

def accepted(result):
    return all(result.get(k) is True for k in ('match', 'complete', 'scope')) and result.get('uncertain') is False

def target_fields(q, key):
    from figure_slots import parsed, PLACEHOLDER
    found = []
    def walk(node, label):
        for field in ('stem', 'answerText'):
            text = node.get(field) or ''
            if any(m.group(1) == key for m in PLACEHOLDER.finditer(text)):
                found.append(label + '/' + field + ': ' + text)
        for option in parsed(node.get('options')):
            if isinstance(option, dict) and any(m.group(1) == key for m in PLACEHOLDER.finditer(option.get('text') or '')):
                found.append(label + '/选项' + str(option.get('label')) + ': ' + option.get('text', ''))
        for sub in parsed(node.get('subQuestions')):
            walk(sub, label + '/子题' + str(sub.get('number')))
    walk(q, '题目')
    return '\n'.join(found) or '无法定位槽位，请判uncertain，保留待人工处理'

def check(q, figure, pages, crop):
    if (OUT / 'STOP').exists():
        raise KeyboardInterrupt
    text = PROMPT.format(question=api.collect_subq_stems(q)[:6000],
                         target=target_fields(q, str(figure['figKey']))[:4000], note=figure['note'] or '')
    parts = [{'type': 'text', 'text': text}]
    parts += [api.img_part(p, max_dim=2200) for p in pages]
    parts.append(api.img_part(crop, max_dim=1600))
    result = api.vision_call(parts, max_tokens=2048)
    if not isinstance(result, dict) or any(not isinstance(result.get(k), bool) for k in ('match', 'complete', 'scope', 'uncertain')):
        return {'match': False, 'complete': False, 'scope': False, 'uncertain': True,
                'reason': 'API调用失败或字段不合法', 'box': None}
    return result

def run(limit=0):
    OUT.mkdir(parents=True, exist_ok=True)
    if (OUT / 'STOP').exists():
        raise SystemExit('Trial manually stopped; no automatic restart')
    db = api.get_db()
    backup = OUT / 'before_trial.db'
    if not backup.exists():
        with sqlite3.connect(backup) as dest:
            db.backup(dest)
    rows = db.execute('SELECT f.*,q.paperId,q.number,q.stem,q.options,q.subQuestions,q.answerText '
                      'FROM figures f JOIN questions q USING(qid) WHERE q.paperId IN (?,?) ORDER BY q.paperId,f.id', tuple(PAPERS)).fetchall()
    if limit:
        rows = rows[:limit]
    usage = []
    original_post = api.requests.post
    def measured(*args, **kwargs):
        if (OUT / 'STOP').exists():
            raise KeyboardInterrupt
        response = original_post(*args, **kwargs)
        try:
            usage.append(response.json().get('usage', {}))
        except ValueError:
            pass
        return response
    api.requests.post = measured
    results = []
    with (OUT / 'results.jsonl').open('a', buffering=1) as log:
        for row in rows:
            if (OUT / 'STOP').exists():
                break
            q = dict(row)
            source = api.ROOT / '其他城市/重庆/2022' / PAPERS[q['paperId']]
            pages = [source / f'{p:02d}.png' for p in source_pages(q['number'])]
            original = api.BANK / q['imagePath']
            record = {'id': q['id'], 'qid': q['qid'], 'figKey': q['figKey'],
                      'originalPath': q['imagePath'], 'sourcePaths': [str(p.relative_to(api.ROOT)) for p in pages]}
            history = OUT / 'originals' / original.name
            history.parent.mkdir(exist_ok=True)
            if not history.exists():
                shutil.copy2(original, history)
            assessment = check(q, q, pages, original)
            record['before'] = assessment
            current = original
            for attempt in range(2):
                if accepted(assessment) or assessment.get('uncertain'):
                    break
                box, page_index = assessment.get('box'), assessment.get('sourcePage')
                if not valid_box(box) or not isinstance(page_index, int) or isinstance(page_index, bool) or not 1 <= page_index <= len(pages):
                    break
                chosen = pages[page_index - 1]
                with Image.open(chosen) as image:
                    w, h = image.size
                    pixel_box = (math.floor(box[0] * w), math.floor(box[1] * h), math.ceil(box[2] * w), math.ceil(box[3] * h))
                    candidate = api.ASSETS / (original.stem + f'_source_review_{attempt+1}.png')
                    image.crop(pixel_box).save(candidate)
                assessment = check(q, q, pages, candidate)
                record.setdefault('repairs', []).append({'sourcePath': str(chosen.relative_to(api.ROOT)),
                    'box': box, 'pixelBox': pixel_box, 'imagePath': str(candidate.relative_to(api.BANK)), 'review': assessment})
                if accepted(assessment):
                    current = candidate
            model_status = 'ok' if accepted(assessment) else 'unchecked' if assessment.get('uncertain') else 'suspect'
            # Model-only success is provisional until visual human acceptance.
            if current != original:
                record['proposedPath'] = str(current.relative_to(api.BANK))
                current = original
            status = 'unchecked' if model_status == 'ok' else model_status
            record['modelStatus'] = model_status
            record.update(after=assessment, status=status, changed=current != original,
                          finalPath=str(current.relative_to(api.BANK)))
            if current != original:
                db.execute('UPDATE figures SET imagePath=?,page=?,note=?,matchStatus=? WHERE id=?',
                           (record['finalPath'], 'source-review:' + record['repairs'][-1]['sourcePath'],
                            '原卷对照审核：' + assessment['reason'], status, q['id']))
            else:
                db.execute('UPDATE figures SET matchStatus=? WHERE id=?', (status, q['id']))
            db.commit()
            results.append(record)
            log.write(json.dumps(record, ensure_ascii=False) + '\n')
            print(json.dumps({'processed': len(results), 'qid': q['qid'], 'figKey': q['figKey'],
                              'status': status, 'recropped': record['changed'], 'reason': assessment['reason']}, ensure_ascii=False), flush=True)
    report = {'provider': 'deepseek', 'model': api.MODEL, 'planned': len(rows), 'processed': len(results),
              'beforeAccepted': sum(accepted(r['before']) for r in results),
              'afterAccepted': sum(r['status'] == 'ok' for r in results),
              'recroppedAccepted': sum(r['changed'] for r in results),
              'suspect': sum(r['status'] == 'suspect' for r in results),
              'uncertain': sum(r['status'] == 'unchecked' for r in results),
              'requests': len(usage), 'promptTokens': sum(u.get('prompt_tokens', 0) for u in usage),
              'completionTokens': sum(u.get('completion_tokens', 0) for u in usage), 'results': results}
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    subprocess.run([sys.executable, str(Path(__file__).with_name('export_viewer.py'))], check=True)
    print(json.dumps({k: v for k, v in report.items() if k != 'results'}, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('command', choices=['run', 'stop'])
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()
    if args.command == 'stop':
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / 'STOP').write_text('Manual stop\n')
        print('Stop requested; no further API requests will start')
    else:
        run(args.limit)
