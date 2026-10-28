"""Ten source-anchored samples: explicit slot contracts, grid reference and local checks.

Produces candidates only. Applying any candidate requires separate visual acceptance.
The search regions were selected by inspecting the original pages, not by the model.
"""
import json
import math
import sqlite3
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
import fig_verify as api
from source_figure_review import PAPERS, valid_box

OUT = api.STATE / 'chongqing_sample_20261014'
SAMPLES = [
    (4006, 2, 'A卷5题选项C，仅该电路及C标记，不含其他选项、龙头实物和第6题', [.555,.095,.735,.21]),
    (4010, 2, 'A卷6题选项D，花样滑冰照片及D标记，不含A/B/C', [.735,.225,.915,.365]),
    (4011, 2, 'A卷8题图5整体，甲正方体示意图和乙压强曲线，含坐标、单位、甲乙和图5标记', [.515,.595,.925,.775]),
    (4014, 3, 'A卷13题图8甲，仅完整电路及甲标记；图8乙另有槽位，不要重复包含', [.395,.365,.65,.55]),
    (4015, 3, 'A卷13题图8乙，仅完整I-R坐标图及乙标记，含I/A、R2/Ω、a/b、I1', [.675,.36,.935,.545]),
    (4016, 3, 'A卷14题第一小问图9甲，凸透镜、主光轴、F、入射光线及甲，保留原题作图状态', [.145,.805,.535,.928]),
    (4026, 2, 'B卷6题选项A，仅完整电路及A标记，不含B/C/D及题干', [.045,.392,.273,.543]),
    (4030, 2, 'B卷7题图4完整电路，含电源、S、R/P、L、A、V及图4标记', [.66,.586,.925,.71]),
    (4034, 3, 'B卷13题图8乙，仅完整小灯泡I-U坐标图及乙标记，甲电路已有独立槽位', [.545,.36,.875,.531]),
    (4042, 6, 'B卷20题图15整体，甲实验装置和乙F-h曲线，含力传感器、A/B、液面、F1/F2及单位', [.115,.53,.90,.765]),
]

def grid_reference(source, dest):
    with Image.open(source) as im:
        im = im.convert('RGB')
        draw = ImageDraw.Draw(im)
        w, h = im.size
        for n in range(1, 20):
            x, y = round(w*n/20), round(h*n/20)
            draw.line([(x,0),(x,h)], fill=(30,150,180), width=1)
            draw.line([(0,y),(w,y)], fill=(30,150,180), width=1)
            if n % 2 == 0:
                draw.text((x+1,1),f'{n/20:.1f}',fill=(0,60,150))
                draw.text((1,y+1),f'{n/20:.1f}',fill=(0,60,150))
        im.save(dest)

def crop_with_checks(source, box, dest):
    if not valid_box(box):
        raise ValueError('Invalid or out-of-page bounding box')
    with Image.open(source) as im:
        w,h = im.size
        px = [math.floor(box[0]*w),math.floor(box[1]*h),math.ceil(box[2]*w),math.ceil(box[3]*h)]
        crop = im.crop(px)
        crop.save(dest)
        gray = np.asarray(crop.convert('L'))
        threshold = float(np.percentile(gray,70))-55
        ink = gray < threshold
        edge = {'top':float(ink[:2].mean()),'bottom':float(ink[-2:].mean()),
                'left':float(ink[:,:2].mean()),'right':float(ink[:,-2:].mean())}
        # Exact source pixels are preserved; no restoration, repainting or generated content.
        assert np.array_equal(np.asarray(crop),np.asarray(Image.open(dest)))
    return {'pixelBox':px,'size':list(crop.size),'exactSourcePixels':True,
            'edgeInkFraction':edge,'boundaryWarning':any(v>.15 for v in edge.values())}

def run():
    OUT.mkdir(parents=True,exist_ok=True)
    db = api.get_db()
    if not (OUT/'before_sample.db').exists():
        with sqlite3.connect(OUT/'before_sample.db') as target:db.backup(target)
    usage=[]
    post=api.requests.post
    def measured(*args,**kwargs):
        if (OUT/'STOP').exists():raise KeyboardInterrupt
        response=post(*args,**kwargs)
        try:usage.append(response.json().get('usage',{}))
        except ValueError:pass
        return response
    api.requests.post=measured
    records=[]
    for fid,page,scope,box in SAMPLES:
        if (OUT/'STOP').exists():break
        row=dict(db.execute('SELECT f.*,q.paperId,q.number FROM figures f JOIN questions q USING(qid) WHERE f.id=?',(fid,)).fetchone())
        source=api.ROOT/'其他城市/重庆/2022'/PAPERS[row['paperId']]/f'{page:02d}.png'
        grid=OUT/f'{fid}_grid.png';grid_reference(source,grid)
        dest=api.ASSETS/f'cq2022_sample_{fid}.png'
        local=crop_with_checks(source,box,dest)
        contract={'qid':row['qid'],'figKey':row['figKey'],'scope':scope,
                  'sourcePath':str(source.relative_to(api.ROOT)),'sourceBox':box,
                  'canonicalReference':row['paperId']+f'/page{page}/'+scope}
        prompt=('请审核以下原卷裁剪。图1为原页，图2为同页坐标网格参考，图3为裁剪图。'
                '图槽定义已明确，不要因同题还有其他独立图槽而要求此槽包含全部图片。'
                '原卷中未作答的图必须保持未作答状态。仅据原图判断，不凭物理常识编造。'
                '目标范围：'+scope+'。当前归一化坐标：'+json.dumps(box)+'。'
                '分别判断对应正确、内容完整、范围适当。返回JSON：'
                '{"match":true/false,"complete":true/false,"scope":true/false,'
                '"uncertain":true/false,"reason":"具体原因","suggestedBox":null或四个0至1坐标}。'
                '不得把坐标网格线当成原卷图形。')
        result=api.vision_call([{'type':'text','text':prompt},api.img_part(source,2200),
                               api.img_part(grid,2200),api.img_part(dest,1600)],max_tokens=2048)
        record={'id':fid,**contract,'originalPath':row['imagePath'],
                'candidatePath':str(dest.relative_to(api.BANK)),'localChecks':local,
                'modelReview':result,'visualReview':'pending','applied':False}
        records.append(record)
        (OUT/'report.json').write_text(json.dumps({'provider':'deepseek','model':api.MODEL,
            'samples':records,'requests':len(usage),'promptTokens':sum(u.get('prompt_tokens',0) for u in usage),
            'completionTokens':sum(u.get('completion_tokens',0) for u in usage)},ensure_ascii=False,indent=2))
        print(json.dumps({'id':fid,'localWarning':local['boundaryWarning'],'modelReview':result},ensure_ascii=False),flush=True)
    # Browser-side before/after comparison; data escaped and images linked to workspace assets.
    import html
    cards=[]
    for r in records:
        cards.append('<article><h2>'+html.escape(r['qid']+'/fig'+str(r['figKey']))+'</h2><p>'+html.escape(r['scope'])+'</p>'
                     '<div><section>修复前<br><img src="../../question-bank/'+html.escape(r['originalPath'],quote=True)+'"></section>'
                     '<section>修复候选<br><img src="../../question-bank/'+html.escape(r['candidatePath'],quote=True)+'"></section></div>'
                     '<p>'+html.escape(json.dumps(r['modelReview'],ensure_ascii=False))+'</p></article>')
    (OUT/'comparison.html').write_text('<!doctype html><meta charset="utf-8"><title>重庆10图修复对比</title><style>body{font:16px sans-serif;margin:24px}article{border-bottom:1px solid #ccc;padding:20px}div{display:flex;gap:24px}section{width:48%}img{max-width:100%;max-height:450px}</style>'+''.join(cards))

if __name__=='__main__':run()
