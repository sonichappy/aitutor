import hashlib
import sqlite3
import tempfile
import unittest
from pathlib import Path
from PIL import Image
import on_demand_figures as m

class HumanEditTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.old=m.BANK,m.DB,m.ROOT
        m.ROOT=Path(self.tmp.name);m.BANK=m.ROOT/'bank';m.BANK.mkdir();(m.BANK/'assets').mkdir();m.DB=m.BANK/'physics.db'
        c=sqlite3.connect(m.DB)
        c.executescript('''CREATE TABLE figures(id INTEGER PRIMARY KEY,qid TEXT,figKey TEXT,label TEXT,page TEXT,imagePath TEXT,note TEXT,cropConfidence REAL,matchStatus TEXT);
        CREATE TABLE questions(qid TEXT,paperId TEXT);''')
        c.execute('INSERT INTO questions VALUES(?,?)',('q',next(iter(m.PAPERS))))
        c.execute("INSERT INTO figures VALUES(1,'q','2','A','1','assets/old.png','old note',0.5,'unchecked')");c.commit();c.close()
        Image.new('RGB',(100,200),'white').save(m.BANK/'source.png');Image.new('RGB',(10,20),'black').save(m.BANK/'assets/old.png')
        self.item={'id':'1','allSources':[{'path':'source.png','page':1,'sha256':hashlib.sha256((m.BANK/'source.png').read_bytes()).hexdigest()}]}
        self.value={'expectedPath':'assets/old.png','expectedHash':hashlib.sha256((m.BANK/'assets/old.png').read_bytes()).hexdigest(),'expectedVersion':None,'target':'manual','source':'source.png','box':[.1,.2,.7,.8],'checks':{k:True for k in ['match','complete','scope','readable']}}
    def tearDown(self):
        m.BANK,m.DB,m.ROOT=self.old;self.tmp.cleanup()
    def test_crop_confirm_history_and_undo(self):
        r=m.apply(self.item,self.value)
        with Image.open(m.BANK/r['imagePath']) as im:self.assertEqual(im.size,(60,120))
        self.assertTrue((m.BANK/'assets/old.png').exists())
        with m.connect() as c:
            self.assertEqual(c.execute('select matchStatus from figures').fetchone()[0],'human_confirmed')
            self.assertIn('normalizedBox',c.execute('select sourceJson from figure_human_versions').fetchone()[0])
        undo={**self.value,'expectedPath':r['imagePath'],'expectedHash':hashlib.sha256((m.BANK/r['imagePath']).read_bytes()).hexdigest(),'expectedVersion':r['version'],'version':r['version']}
        restored=m.apply(self.item,undo,undo=True);self.assertEqual(restored['imagePath'],'assets/old.png');self.assertEqual(restored['status'],'unconfirmed')
    def test_stale_submission_cannot_overwrite(self):
        m.apply(self.item,self.value)
        with self.assertRaises(ValueError):m.apply(self.item,self.value)
    def test_same_image_new_confirmation_blocks_stale_tab(self):
        self.value['target']='original';m.apply(self.item,self.value)
        with self.assertRaises(ValueError):m.apply(self.item,self.value)
    def test_reject_wrong_source_and_invalid_rectangle(self):
        for source,box in [('elsewhere.png',[0,0,1,1]),('source.png',[-1,0,.8,.8]),('source.png',[0,0,float('nan'),1])]:
            with self.assertRaises(ValueError):m.apply(self.item,{**self.value,'source':source,'box':box})
    def test_full_page_fallback_cannot_be_confirmed_as_crop(self):
        self.item["isFallback"]=True;self.value["target"]="original"
        with self.assertRaises(ValueError):m.apply(self.item,self.value)
    def test_checks_required(self):
        with self.assertRaises(ValueError):m.apply(self.item,{**self.value,'checks':{}})

if __name__=='__main__':unittest.main()
