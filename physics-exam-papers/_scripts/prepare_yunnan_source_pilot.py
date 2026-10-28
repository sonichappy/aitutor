"""Register immutable original page scans from the Yunnan 2022 scan-only DOCX. No AI."""
import hashlib,io,json,shutil,sqlite3
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
from PIL import Image
import on_demand_figures as edits

PID='云南-2022-2022云南'
def prepare():
 root=edits.ROOT;bank=edits.BANK
 with edits.connect() as c:
  row=c.execute('select questionGroup from papers where paperId=?',(PID,)).fetchone()
  if not row:raise ValueError('Pilot paper missing')
 source=root/row[0]/'2022年云南中考物理真题.docx'
 digest=hashlib.sha256(source.read_bytes()).hexdigest()
 folder=bank/'sources'/'original-pages'/digest;folder.mkdir(parents=True,exist_ok=True)
 original=folder/'original.docx'
 if not original.exists():shutil.copyfile(source,original)
 pages=[]
 with ZipFile(source) as z:
  xml=ET.fromstring(z.read('word/document.xml'))
  if ''.join(x.text or '' for x in xml.iter() if x.tag.endswith('}t')).strip():raise ValueError('Not a scan-only document; requires layout conversion')
  rels={e.get('Id'):e.get('Target') for e in ET.fromstring(z.read('word/_rels/document.xml.rels'))}
  for el in xml.iter():
   if not el.tag.endswith('}blip'):continue
   rid=el.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
   member='word/'+rels[rid];data=z.read(member)
   with Image.open(io.BytesIO(data)) as im:
    im.verify()
   with Image.open(io.BytesIO(data)) as im:w,h=im.size
   if min(w,h)<600:continue # Ignore the document's 35px decorative icon.
   sha=hashlib.sha256(data).hexdigest();page=len(pages)+1
   path=folder/(f'page-{page:02d}-'+sha[:16]+Path(member).suffix)
   if not path.exists():path.write_bytes(data)
   pages.append({'page':page,'path':str(path.relative_to(bank)),'sha256':sha,'member':member,'width':w,'height':h})
 if len(pages)!=8:raise ValueError('Expected eight original scanned pages')
 manifest={'paperId':PID,'sourcePath':str(original.relative_to(bank)),'sourceSha256':digest,'method':'embedded-scans-in-document-order','pagePhotos':pages,'review':'Eight scanned pages visually checked; question-specific page mapping remains unverified.'}
 (folder/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 with edits.connect() as c:
  existing=list(c.execute('select page,imagePath,sha256 from figure_source_pages where paperId=? order by page',(PID,)))
  desired=[(p['page'],p['path'],p['sha256']) for p in pages]
  if existing and [tuple(r) for r in existing]!=desired:raise ValueError('Existing source mapping differs; refusing overwrite')
  for p in pages:c.execute('insert or ignore into figure_source_pages values(?,?,?,?,?)',(PID,p['page'],p['path'],p['sha256'],str(source)+'#'+p['member']))
 return manifest
if __name__=='__main__':print(json.dumps(prepare(),ensure_ascii=False,indent=2))
