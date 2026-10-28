import unittest,tempfile,sqlite3,json,hashlib
from pathlib import Path
from unittest.mock import patch, MagicMock
from types import SimpleNamespace
import recurring_paper_tasks as m
import kimi_pipeline as api

class PaperTaskTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.old=m.ROOT,m.BANK,m.PRODUCTION,m.STATE
        m.ROOT=Path(self.tmp.name);m.BANK=m.ROOT/'bank';m.BANK.mkdir();m.PRODUCTION=m.BANK/'physics.db';m.STATE=m.ROOT/'state'
        with m.database(m.PRODUCTION) as c:c.executescript(api.SCHEMA)
        self.paper={'paperId':'p','province':'重庆','city':'重庆','year':2022,'stem':'试卷','answerGroups':[]}
        self.q=[{'number':str(n),'stem':'题干','options':[],'answer':{'status':'missing'}} for n in range(1,6)]
    def tearDown(self):m.ROOT,m.BANK,m.PRODUCTION,m.STATE=self.old;self.tmp.cleanup()
    def test_publish_once_and_never_replace_existing_questions(self):
        self.assertTrue(m.publish(api,self.paper,self.q,{},'sources/manifest.json'))
        self.q[0]['stem']='不应覆盖'
        self.assertFalse(m.publish(api,self.paper,self.q,{},'sources/new.json'))
        with m.database(m.PRODUCTION) as c:
            self.assertEqual(c.execute("SELECT stem FROM questions WHERE qid='p#1'").fetchone()[0],'题干')
            self.assertEqual(c.execute('select manifestPath from paper_source_manifests').fetchone()[0],'sources/manifest.json')
    def test_reject_empty_duplicate_and_invalid_answers(self):
        for q in [[],self.q+[self.q[0]],[{**x,'answer':'invalid'} for x in self.q]]:
            with self.assertRaises(ValueError):m.validate(q)
    def test_answer_only_source_and_placeholder_stems_are_rejected(self):
        group=m.ROOT/'参考答案_图片版';group.mkdir();(group/'01.png').write_bytes(b'photo')
        self.assertEqual(m.available_sources({'questionGroups':['参考答案_图片版']},{}),[])
        with self.assertRaises(ValueError):m.validate([{**x,'stem':'题干未提供（OCR 文本仅含官方答案）'} for x in self.q])
    def test_incomplete_and_unplanned_papers_are_only_candidates(self):
        self.assertFalse(m.complete_for_publication(self.q,{'plannedNumbers':list(range(1,27))}))
        self.assertFalse(m.complete_for_publication(self.q,{}))
        qs=[{'number':str(i)} for i in range(1,21)]
        self.assertTrue(m.complete_for_publication(qs,{'plannedNumbers':list(range(1,21))}))
    def test_archive_original_and_photo_hashes(self):
        group=m.ROOT/'paper';group.mkdir();f=group/'01.png';f.write_bytes(b'photo-placeholder')
        p={**self.paper,'questionGroups':['paper']}
        name,manifest=m.archive_sources(p,'paper',SimpleNamespace(IMG_EXT={'.png'}))
        self.assertTrue((m.BANK/name).exists());entry=manifest['pagePhotos'][0]
        self.assertEqual((m.BANK/entry['path']).read_bytes(),f.read_bytes())
        self.assertEqual(entry['sha256'],hashlib.sha256(f.read_bytes()).hexdigest())
    def test_shared_stop_blocks_even_inside_window(self):
        stop=m.ROOT/'_state/recurring_figures/STOP';stop.parent.mkdir(parents=True);stop.write_text('stop')
        with patch.object(m,'window_at',return_value=('night',None)),patch.object(m.time,'time',return_value=1):self.assertFalse(m.allowed(100))
    def test_supervisor_terminates_worker_at_deadline_and_requeues(self):
        with m.connect() as c:c.execute("INSERT INTO jobs(paperId,state) VALUES('p','running')")
        child=MagicMock();child.pid=777777;child.poll.return_value=None
        with patch.object(m,'allowed',side_effect=[True,False]),patch.object(m.subprocess,'Popen',return_value=child),patch.object(m.os,'killpg') as kill:
            m.supervise('test_window',100)
        kill.assert_called_once_with(777777,m.signal.SIGTERM)
        with m.connect() as c:
            self.assertEqual(c.execute('SELECT state FROM runs').fetchone()[0],'deadline_stopped')
            self.assertEqual(c.execute('SELECT state FROM jobs').fetchone()[0],'pending')
    def test_outside_window_blocked(self):
        with patch.object(m,'window_at',return_value=(None,None)):self.assertFalse(m.allowed(9999999999))
    def test_archive_only_does_not_supply_fake_page_photos(self):
        group=m.ROOT/'paper';group.mkdir();(group/'paper.doc').write_bytes(b'raw document')
        _,manifest=m.archive_sources({**self.paper,'questionGroups':['paper']},'paper',SimpleNamespace(IMG_EXT={'.png'}))
        self.assertEqual(len(manifest['files']),1);self.assertEqual(manifest['pagePhotos'],[])

if __name__=='__main__':unittest.main()
