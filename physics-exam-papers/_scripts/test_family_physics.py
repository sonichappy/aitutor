import hashlib,json,sqlite3,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageDraw
import family_physics as m
import kimi_pipeline as schema
import on_demand_figures as edits

def fixture(bank):
 bank.mkdir(parents=True,exist_ok=True);(bank/'assets').mkdir(exist_ok=True);(bank/'sources').mkdir(exist_ok=True)
 db=bank/'physics.db'
 with sqlite3.connect(db) as c:
  c.executescript(schema.SCHEMA+'''ALTER TABLE questions ADD COLUMN uid INTEGER;
  CREATE TABLE figures(id INTEGER PRIMARY KEY,qid TEXT,figKey TEXT,label TEXT,page TEXT,imagePath TEXT,note TEXT,cropConfidence REAL,matchStatus TEXT,UNIQUE(qid,figKey));''')
  c.execute("insert into papers values('sample','重庆','重庆',2022,'重庆2022测试卷',1,'', '[]',3,'done','test')")
  for n in range(1,4):
   typ='single_choice' if n!=3 else 'calculation';stem='声音由什么产生？{{fig:1}}' if n==1 else '比较音调和响度的变化。' if n==2 else '写出声音产生和传播的条件。'
   q={'number':str(n),'type':typ,'stem':stem,'options':[{'label':'A','text':'振动'},{'label':'B','text':'温度'}] if n!=3 else [],'answer':{'status':'official','choice':'A' if n!=3 else '', 'text':'物体振动产生声音。','analysis':'观察振动与声音的对应关系。'},'chapters':[{'chapter':'第二章 声现象'}]}
   c.execute('insert into questions(qid,paperId,number,type,stem,options,subQuestions,answerStatus,answerChoice,answerText,analysis,chapters,uid) values(?,?,?,?,?,?,?,?,?,?,?,?,?)',(f'sample#{n}','sample',str(n),typ,stem,json.dumps(q['options'],ensure_ascii=False),'[]','official',q['answer']['choice'],q['answer']['text'],q['answer']['analysis'],json.dumps(q['chapters'],ensure_ascii=False),n))
  c.execute("insert into figures values(1,'sample#1','1','题干图','1','assets/old.png','原配图',.5,'unchecked')")
 im=Image.new('RGB',(600,800),'white');draw=ImageDraw.Draw(im);draw.rectangle((120,160,420,480),outline='black',width=5);im.save(bank/'sources/page.png');im.crop((110,150,430,490)).save(bank/'assets/old.png')
 old=edits.DB,edits.BANK;edits.DB=db;edits.BANK=bank
 with edits.connect() as c:c.execute('insert into figure_source_pages values(?,?,?,?,?)',('sample',1,'sources/page.png',hashlib.sha256((bank/'sources/page.png').read_bytes()).hexdigest(),str(bank/'sources/page.png')))
 edits.DB,edits.BANK=old
 return db

class FamilyTest(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.old=m.BANK,m.DB,m.STUDY,edits.DB,edits.BANK
  m.BANK=Path(self.tmp.name)/'bank';m.DB=fixture(m.BANK);m.STUDY=Path(self.tmp.name)/'study.db'
  setup=m.dispatch('POST',['setup'],{'password':'test-only-password','pin':'test-only-admin'},'');self.token=hashlib.sha256(setup['_session'].encode()).hexdigest()
 def tearDown(self):m.BANK,m.DB,m.STUDY,edits.DB,edits.BANK=self.old;self.tmp.cleanup()
 def call(self,name,data=None,token=None):return m.dispatch('POST' if data is not None else 'GET',[name],data or {},token if token is not None else self.token)
 def unlock(self):
  login=self.call('login',{'username':'administrator','password':'test-only-admin'});self.token=hashlib.sha256(login['_session'].encode()).hexdigest()
 def test_ninth_grade_chapters_and_progress(self):
  with sqlite3.connect(m.DB) as c:c.execute("update questions set chapters=? where qid='sample#3'",(json.dumps([{'grade':'九年级全一册','chapter':'第十八章 电功率'}],ensure_ascii=False),))
  overview=self.call('overview');ninth=[ch for ch in overview['chapters'] if ch['book']=='九全']
  self.assertEqual(len(ninth),10)
  self.assertEqual(next(ch for ch in ninth if ch['id']=='electric-power')['count'],1)
  self.assertEqual(self.call('questions',{'chapter':'electric-power'})['total'],1)
  self.call('settings',{'book':'九全','chapter':'electric-power'})
  self.assertEqual(self.call('overview')['settings']['book'],'九全')
 def test_open_issue_disables_all_student_entrypoints_and_resolve_reopen(self):
  student=self.token;admin,other=self.student_account()
  self.call('attempt',{'qid':'sample#1','chapter':'sound','answer':'B'},token=student)
  self.call('flag',{'qid':'sample#1','reason':'裁图错误'},token=student)
  self.call('flag',{'qid':'sample#1','reason':'答案待核对'},token=admin)
  for token in [student,other]:
   self.assertEqual(self.call('questions',{'chapter':'sound'},token=token)['total'],2)
   for endpoint,data in [('question',{'qid':'sample#1'}),('attempt',{'qid':'sample#1','answer':'A'}),('similar',{'qid':'sample#1'})]:
    with self.assertRaises(m.Error):self.call(endpoint,data,token=token)
  self.assertTrue(self.call('overview',token=student)['wrong'][0]['unavailable'])
  issues=self.call('issues',{'state':'open'},token=admin)['items'];self.assertEqual(len(issues),2)
  self.call('resolve',{'id':issues[0]['id'],'note':'修好答案'},token=admin)
  with self.assertRaises(m.Error):self.call('question',{'qid':'sample#1'},token=student)
  self.call('resolve',{'id':issues[1]['id'],'note':'修好图片'},token=admin)
  self.assertEqual(self.call('question',{'qid':'sample#1'},token=student)['qid'],'sample#1')
  self.call('reopen',{'id':issues[0]['id'],'note':'再次发现'},token=admin)
  with self.assertRaises(m.Error):self.call('attempt',{'qid':'sample#1','answer':'A'},token=student)
  history=self.call('management-history',{'search':'sample#1'},token=admin)['items']
  self.assertEqual(len(history),5);self.assertIn('再次发现',history[0]['detail'])
  with self.assertRaises(m.Error):self.call('management-history',token=student)
  with self.assertRaises(m.Error):self.call('unlock',{'pin':'test-only-admin'},token=student)
 def test_history_query_dates_and_pagination(self):
  self.unlock()
  for n in range(23):self.call('flag',{'qid':'sample#2','reason':'待核查 '+str(n)})
  first=self.call('management-history',{'search':'sample#2'});second=self.call('management-history',{'search':'sample#2','page':1})
  self.assertEqual(first['total'],23);self.assertEqual(len(first['items']),20);self.assertEqual(len(second['items']),3)
  self.assertFalse({r['id'] for r in first['items']}&{r['id'] for r in second['items']})
  self.assertEqual(self.call('management-history',{'start':'2000-01-01','end':'2000-01-02'})['total'],0)
  with self.assertRaises(m.Error):self.call('management-history',{'start':'bad'})
  self.assertEqual(self.call('questions',{'manage':'1','search':'sample#2'})['total'],1)
 def test_daily_calendar_timezone_duplicates_and_isolation(self):
  from datetime import datetime
  from zoneinfo import ZoneInfo
  admin,other=self.student_account()
  with m.connection(m.STUDY) as c:
   for date,ch,qid,correct in [('2026-10-27T23:59:59','sound','sample#1',0),('2026-10-28T00:00:00','sound','sample#1',1),('2026-10-28T12:00:00','light','sample#1',0)]:
    ts=datetime.fromisoformat(date).replace(tzinfo=ZoneInfo('Asia/Shanghai')).timestamp()
    c.execute('insert into attempts(studentId,qid,chapter,answer,correct,mode,created,due) values(?,?,?,?,?,?,?,?)',('legacy-student',qid,ch,'A',correct,'automatic',ts,ts))
  data={'start':'2026-10-27','end':'2026-10-29'}
  days=self.call('learning-calendar',data)['days'];self.assertEqual([d['attempts'] for d in days],[1,2,0]);self.assertEqual(days[1]['questions'],1);self.assertEqual(days[1]['correct'],1);self.assertEqual(len(days[1]['chapters']),2);self.assertEqual(days[1]['chapters'][0]['questions'],1)
  self.assertEqual(sum(d['attempts'] for d in self.call('learning-calendar',data,token=other)['days']),0)
  self.assertEqual(self.call('learning-calendar',{**data,'studentId':'legacy-student'},token=admin)['days'],days)
  with self.assertRaises(m.Error):self.call('learning-calendar',{**data,'studentId':'legacy-student'},token=other)
  with self.assertRaises(m.Error):self.call('learning-calendar',{'start':'2026-10-29','end':'2026-10-27'})
 def test_student_admin_update_and_session_invalidation(self):
  admin,other=self.student_account();id=self.call('bootstrap',token=other)['user']['userId']
  self.call('student-update',{'studentId':id,'name':'新昵称','password':'changed-password'},token=admin)
  self.assertFalse(self.call('bootstrap',token=other)['logged'])
  login=self.call('login',{'username':'student_two','password':'changed-password'});token=hashlib.sha256(login['_session'].encode()).hexdigest()
  self.assertEqual(self.call('bootstrap',token=token)['user']['name'],'新昵称')
  self.call('student-update',{'studentId':id,'active':False},token=admin)
  self.assertFalse(self.call('bootstrap',token=token)['logged'])
 def test_login_permissions_and_second_device(self):
  with self.assertRaises(m.Error):self.call('questions',{'chapter':'sound'},token='')
  with self.assertRaises(m.Error):self.call('edit',{'qid':'sample#1'})
  second=self.call('login',{'password':'test-only-password'});t=hashlib.sha256(second['_session'].encode()).hexdigest();self.assertTrue(self.call('bootstrap',token=t)['logged'])
  self.unlock();self.assertFalse(self.call('bootstrap',token=t)['admin'])
 def test_draft_and_learning_settings_persist(self):
  self.call('settings',{'book':'八下','chapter':'sound'});self.call('draft',{'qid':'sample#1','answer':'B'})
  self.assertEqual(self.call('question',{'qid':'sample#1'})['draft'],'B');self.assertEqual(self.call('overview')['settings']['book'],'八上')
  self.assertEqual(self.call('overview')['settings']['lastQid'],'sample#1')
 def test_wrong_answer_review_and_correction(self):
  r=self.call('attempt',{'qid':'sample#1','chapter':'sound','answer':'B','correct':True});self.assertFalse(r['correct'])
  self.assertEqual(len(self.call('overview')['wrong']),1)
  self.call('attempt',{'qid':'sample#1','chapter':'sound','answer':'A'});o=self.call('overview');self.assertEqual(len(o['wrong']),1);self.assertEqual(o['wrong'][0]['wrongCount'],1);self.assertEqual(o['wrong'][0]['correct'],1);self.assertEqual(len(o['attempts']),2)
  self.assertEqual(o['stats']['practiced'],1);self.assertEqual(o['stats']['correct'],1)
 def test_subjective_question_requires_self_assessment(self):
  with self.assertRaises(m.Error):self.call('attempt',{'qid':'sample#3','answer':'有介质'})
  r=self.call('attempt',{'qid':'sample#3','answer':'有介质','correct':False});self.assertEqual(r['mode'],'self')
 def test_edit_version_conflict_and_flag_resolution(self):
  self.call('flag',{'qid':'sample#1','reason':'图不清楚'});self.unlock();q=self.call('question',{'qid':'sample#1'})
  data={'qid':q['qid'],'revision':q['revision'],'stem':'修订后的题干','analysis':'补充解析'};self.call('edit',data)
  with self.assertRaises(m.Error):self.call('edit',data)
  flag=self.call('overview')['flags'][0];self.call('resolve',{'id':flag['id']});self.assertEqual(self.call('overview')['flags'],[])
 def test_manual_crop_preserves_original_and_undo(self):
  self.unlock();q=self.call('question',{'qid':'sample#1'});f=q['figures']['1'];source=self.call('sources',{'qid':q['qid']})['pages'][0]
  data={'qid':q['qid'],'figKey':'1','source':source['path'],'box':[.2,.2,.7,.6],'expectedPath':f['imagePath'],'expectedHash':f['hash'],'expectedVersion':f['version'],'checks':{k:True for k in ['match','complete','scope','readable']}}
  next=self.call('crop',data);nf=next['figures']['1'];self.assertEqual(nf['matchStatus'],'human_confirmed');self.assertTrue((m.BANK/'assets/old.png').exists())
  with Image.open(m.BANK/nf['imagePath']) as im:self.assertEqual(im.size,(300,320))
  with self.assertRaises(m.Error):self.call('crop',data)
  restored=self.call('undo',{**data,'expectedPath':nf['imagePath'],'expectedHash':nf['hash'],'expectedVersion':nf['version'],'version':nf['version']});self.assertEqual(restored['figures']['1']['imagePath'],'assets/old.png')
 def test_invalid_crop_and_media_traversal_blocked(self):
  self.unlock();q=self.call('question',{'qid':'sample#1'});f=q['figures']['1']
  with self.assertRaises(m.Error):self.call('crop',{'qid':q['qid'],'figKey':'7','source':'elsewhere','box':[-1,0,1,1],'expectedPath':'','expectedHash':None,'checks':{k:True for k in ['match','complete','scope','readable']}})
  self.assertNotIn('7',self.call('question',{'qid':q['qid']})['figures'])
  with self.assertRaises(m.Error):self.call('media',{'path':'../../pipeline.env','hash':'fake'})
 def test_similar_matches_and_labels_chapter_fallback(self):
  r=self.call('similar',{'qid':'sample#1'})
  self.assertEqual(len(r['items']),2)
  self.assertTrue(all(x['kind']=='相关练习' for x in r['items']))
  with m.connection(m.DB) as c:c.execute("update questions set topics=? where qid in ('sample#1','sample#2')",(json.dumps(['声音的产生']),))
  r=self.call('similar',{'qid':'sample#1'})
  self.assertEqual(r['items'][0]['question']['qid'],'sample#2');self.assertEqual(r['items'][0]['kind'],'同知识点练习')
 def test_similar_excludes_duplicate_unanswered_flagged_and_missing_images(self):
  with m.connection(m.DB) as c:
   c.execute("update questions set stem=(select stem from questions where qid='sample#1') where qid='sample#2'")
   c.execute("update questions set answerStatus='missing' where qid='sample#3'")
  self.assertEqual(self.call('similar',{'qid':'sample#1'})['items'],[])
  with m.connection(m.DB) as c:c.execute("update questions set stem='另一个振动问题 {{fig:9}}' where qid='sample#2'")
  self.assertEqual(self.call('similar',{'qid':'sample#1'})['items'],[])
  with m.connection(m.DB) as c:c.execute("update questions set stem='另一个振动问题' where qid='sample#2'")
  self.call('flag',{'qid':'sample#2','reason':'答案有误'})
  self.assertEqual(self.call('similar',{'qid':'sample#1'})['items'],[])
 def test_similar_prefers_unpracticed_and_requires_login(self):
  self.call('attempt',{'qid':'sample#2','answer':'A','chapter':'sound'})
  r=self.call('similar',{'qid':'sample#1'});self.assertEqual(r['items'][0]['question']['qid'],'sample#3')
  self.assertTrue(r['items'][1]['practiced'])
  with self.assertRaises(m.Error):self.call('similar',{'qid':'sample#1'},token='')
 def test_similar_no_unrelated_padding(self):
  with m.connection(m.DB) as c:c.execute("update questions set chapters='[]', topics='[]' where qid!='sample#1'")
  self.assertEqual(self.call('similar',{'qid':'sample#1'})['items'],[])
 def student_account(self):
  admin=self.call('login',{'username':'administrator','password':'test-only-admin'})
  maint=hashlib.sha256(admin['_session'].encode()).hexdigest()
  self.call('students',{'username':'student_two','name':'学生二','password':'second-password'},token=maint)
  login=self.call('login',{'username':'student_two','password':'second-password'})
  return maint,hashlib.sha256(login['_session'].encode()).hexdigest()
 def test_students_isolated_even_with_forged_student_id(self):
  maint,other=self.student_account()
  self.call('draft',{'qid':'sample#1','answer':'我的草稿'})
  self.call('settings',{'chapter':'sound','book':'八上'})
  self.call('attempt',{'qid':'sample#2','chapter':'sound','answer':'B'})
  o=self.call('overview',{'studentId':'legacy-student'},token=other)
  self.assertEqual(o['stats']['attempts'],0);self.assertEqual(o['wrong'],[]);self.assertEqual(o['flags'],[]);self.assertEqual(o['settings'],{})
  self.assertEqual(self.call('question',{'qid':'sample#1','studentId':'legacy-student'},token=other)['draft'],'')
  self.call('draft',{'qid':'sample#1','answer':'学生二草稿','studentId':'legacy-student'},token=other)
  self.call('attempt',{'qid':'sample#2','chapter':'sound','answer':'A','studentId':'legacy-student'},token=other)
  self.assertEqual(self.call('question',{'qid':'sample#1'})['draft'],'我的草稿')
  self.assertEqual(len(self.call('overview')['wrong']),1)
  self.assertEqual(self.call('overview',token=other)['stats']['correct'],1)
  self.call('flag',{'qid':'sample#1','reason':'学生一的问题'})
  self.assertEqual(self.call('overview',token=other)['flags'],[])
  with self.assertRaises(m.Error):self.call('students',token=other)
  with self.assertRaises(m.Error):self.call('student-stats',{'studentId':'legacy-student'},token=other)
  with self.assertRaises(m.Error):self.call('edit',{'qid':'sample#1'},token=other)
 def test_same_student_shares_devices_and_maintenance_sees_stats(self):
  maint,other=self.student_account()
  login=self.call('login',{'username':'student_two','password':'second-password'})
  device=hashlib.sha256(login['_session'].encode()).hexdigest()
  self.call('draft',{'qid':'sample#1','answer':'跨设备草稿'},token=other)
  self.assertEqual(self.call('question',{'qid':'sample#1'},token=device)['draft'],'跨设备草稿')
  self.call('attempt',{'qid':'sample#2','chapter':'sound','answer':'B'},token=device)
  self.assertEqual(len(self.call('overview',token=other)['wrong']),1)
  students=self.call('students',token=maint)['students'];second=next(x for x in students if x['username']=='student_two')
  self.assertEqual(second['stats']['attempts'],1);self.assertEqual(second['wrong'],1)
  detail=self.call('student-stats',{'studentId':second['id']},token=maint)
  self.assertEqual(detail['attempts'][0]['answer'],'B')
  with self.assertRaises(m.Error):self.call('attempt',{'qid':'sample#1','answer':'A'},token=maint)
  self.call('logout',{},token=other)
  self.assertTrue(self.call('bootstrap',token=device)['logged'])
 def test_legacy_migration_preserves_records_and_revokes_shared_sessions(self):
  m.STUDY=Path(self.tmp.name)/'legacy.db'
  with sqlite3.connect(m.STUDY) as c:
   c.executescript("""create table config(key text primary key,value text);
   create table attempts(id integer primary key,qid text,chapter text,answer text,correct integer,mode text,created real,due real);
   create table drafts(qid text primary key,answer text,updated real);
   create table settings(key text primary key,value text);
   create table sessions(token text primary key,expires real,adminUntil real default 0);
   insert into attempts values(1,'sample#1','sound','B',0,'automatic',1,2);
   insert into drafts values('sample#2','旧草稿',1);
   insert into settings values('chapter','sound');
   insert into sessions values('shared-token',9999999999,9999999999);""")
   c.executemany('insert into config values(?,?)',[('password',m.hash_password('old-password')),('pin',m.hash_password('old-admin'))])
  m.init();m.init()
  self.assertFalse(self.call('bootstrap',token='shared-token')['logged'])
  login=self.call('login',{'username':'student','password':'old-password'});token=hashlib.sha256(login['_session'].encode()).hexdigest()
  self.assertEqual(len(self.call('overview',token=token)['wrong']),1)
  self.assertEqual(self.call('question',{'qid':'sample#2'},token=token)['draft'],'旧草稿')
  self.assertEqual(self.call('overview',token=token)['settings']['chapter'],'sound')
 def test_stale_tab_cannot_write_after_cookie_account_switch(self):
  maint,other=self.student_account()
  with self.assertRaises(m.Error) as caught:
   m.dispatch('POST',['draft'],{'qid':'sample#1','answer':'旧页面草稿'},other,expected_user='legacy-student')
  self.assertEqual(caught.exception.status,409)
  self.assertEqual(self.call('question',{'qid':'sample#1'},token=other)['draft'],'')
 def test_administrator_username_migration_retains_password_and_sessions(self):
  with m.connection(m.STUDY) as c:
   c.execute("update users set username='maintenance' where id='maintenance'")
  m.init()
  login=self.call('login',{'username':'administrator','password':'test-only-admin'})
  token=hashlib.sha256(login['_session'].encode()).hexdigest()
  self.assertTrue(self.call('bootstrap',token=token)['admin'])
  self.assertEqual(self.call('bootstrap',token=token)['user']['username'],'administrator')
  with self.assertRaises(m.Error):self.call('login',{'username':'maintenance','password':'test-only-admin'})
  self.assertEqual(len(self.call('students',token=token)['students']),1)
 def test_historical_wrong_counts_sort_and_survive_success(self):
  for id,answer in [('sample#1','B'),('sample#2','B'),('sample#1','B'),('sample#1','A')]:self.call('attempt',{'qid':id,'chapter':'sound','answer':answer})
  wrong=self.call('overview')['wrong']
  self.assertEqual([a['qid'] for a in wrong],['sample#1','sample#2'])
  self.assertEqual((wrong[0]['wrongCount'],wrong[0]['attemptCount'],wrong[0]['correctCount'],wrong[0]['correct']),(2,3,1,1))
  self.call('attempt',{'qid':'sample#2','chapter':'sound','answer':'B'})
  self.assertEqual(self.call('overview')['wrong'][0]['qid'],'sample#2')
 def test_historical_wrong_counts_include_history_older_than_500(self):
  self.call('attempt',{'qid':'sample#1','answer':'B'})
  with m.connection(m.STUDY) as c:
   c.executemany("insert into attempts(studentId,qid,chapter,answer,correct,mode,created,due) values('legacy-student','sample#1','sound','A',1,'automatic',?,?)",[(n+100,n+200) for n in range(501)])
  wrong=self.call('overview')['wrong'][0]
  self.assertEqual(wrong['wrongCount'],1);self.assertEqual(wrong['attemptCount'],502);self.assertEqual(wrong['correctCount'],501)
 def test_question_filters_combined_and_history_remains_wrong(self):
  self.call('attempt',{'qid':'sample#1','answer':'B','chapter':'sound'})
  self.call('attempt',{'qid':'sample#1','answer':'A','chapter':'sound'})
  self.call('draft',{'qid':'sample#2','answer':'草稿'})
  r=self.call('questions',{'chapter':'sound','province':'重庆','city':'重庆','year':'2022','type':'single_choice','practiced':'yes','wrong':'yes'})
  self.assertEqual(r['total'],1);self.assertEqual(r['items'][0]['qid'],'sample#1')
  self.assertEqual(r['items'][0]['practiceCount'],2);self.assertEqual(r['items'][0]['wrongCount'],1)
  self.assertEqual(self.call('questions',{'chapter':'sound','practiced':'no','wrong':'no'})['total'],2)
  self.assertEqual(self.call('questions',{'chapter':'sound','practiced':'no','wrong':'yes'})['total'],0)
  self.assertEqual(self.call('questions',{'chapter':'sound','province':'不存在'})['total'],0)
  self.assertEqual(r['filters']['years'],[2022]);self.assertIn('calculation',r['filters']['types'])
 def test_question_history_filters_are_student_scoped(self):
  _,other=self.student_account()
  self.call('attempt',{'qid':'sample#1','answer':'B'})
  self.assertEqual(self.call('questions',{'chapter':'sound','practiced':'yes','studentId':'legacy-student'},token=other)['total'],0)
  self.assertEqual(self.call('questions',{'chapter':'sound','wrong':'yes','studentId':'legacy-student'},token=other)['total'],0)
  self.assertEqual(self.call('questions',{'chapter':'sound','practiced':'no'},token=other)['total'],3)
 def test_question_filters_pagination_and_validation(self):
  with m.connection(m.DB) as c:
   for n in range(4,14):c.execute("insert into questions(qid,paperId,number,type,stem,options,subQuestions,answerStatus,answerChoice,chapters,uid) select ?,paperId,?,'single_choice',?,'[]','[]','official','A',chapters,? from questions where qid='sample#2'",(f'sample#{n}',str(n),f'声音问题{n}',n))
  r=self.call('questions',{'chapter':'sound','page':1,'type':'single_choice'})
  self.assertEqual(r['total'],12);self.assertEqual(len(r['items']),4);self.assertEqual(r['page'],1)
  r=self.call('questions',{'chapter':'sound','page':1,'type':'calculation'})
  self.assertEqual(r['total'],1);self.assertEqual(r['page'],0)
  for data in [{'year':'invalid'},{'practiced':'bad'},{'wrong':'bad'}]:
   with self.assertRaises(m.Error):self.call('questions',{'chapter':'sound',**data})
 def test_multi_select_filters_or_within_and_between_groups(self):
  with m.connection(m.DB) as c:
   c.execute("insert into papers values('second','四川','成都',2023,'第二测试卷',1,'','[]',1,'done','test')")
   c.execute("update questions set paperId='second',chapters=? where qid='sample#3'",(json.dumps([{'chapter':'第三章 物态变化'}]),))
  r=self.call('questions',{'chapters':['sound','heat'],'province':['重庆','四川'],'city':['重庆','成都'],'year':['2022','2023'],'type':['single_choice','calculation']})
  self.assertEqual(r['total'],3)
  r=self.call('questions',{'chapters':json.dumps(['sound','heat']),'province':json.dumps(['重庆','四川']),'year':json.dumps(['2023']),'type':json.dumps(['calculation'])})
  self.assertEqual(r['total'],1);self.assertEqual(r['items'][0]['qid'],'sample#3')
  self.assertEqual(self.call('questions',{'chapters':['sound'],'province':['四川']})['total'],0)
 def test_multi_status_both_means_all_and_clear_chapters(self):
  self.call('attempt',{'qid':'sample#1','answer':'B'})
  r=self.call('questions',{'chapters':[],'practiced':['yes','no'],'wrong':['yes','no']})
  self.assertEqual(r['total'],3)
  r=self.call('questions',{'chapters':['sound'],'practiced':['yes','no'],'wrong':['yes']})
  self.assertEqual(r['total'],1)
  for data in [{'chapters':['bad']},{'province':{'bad':1}},{'year':['2022','bad']},{'practiced':['yes','bad']},{'type':'[broken'}]:
   with self.assertRaises(m.Error):self.call('questions',{'chapter':'sound',**data})
 def test_filter_preferences_persist_across_devices_and_chapters(self):
  prefs={'province':['重庆'],'year':['2022'],'type':['single_choice','calculation'],'wrong':['yes']}
  saved=self.call('practice-preferences',prefs)
  self.assertEqual(saved['type'],['single_choice','calculation'])
  self.assertNotIn('chapters',saved)
  login=self.call('login',{'username':'student','password':'test-only-password'})
  device=hashlib.sha256(login['_session'].encode()).hexdigest()
  self.assertEqual(self.call('practice-preferences',token=device),saved)
  self.call('settings',{'chapter':'heat','book':'八上'},token=device)
  self.assertEqual(self.call('practice-preferences',token=device),saved)
  self.assertEqual(json.loads(self.call('overview',token=device)['settings']['practiceFilters']),saved)
  self.call('practice-preferences',{},token=device)
  self.assertTrue(all(not v for v in self.call('practice-preferences').values()))
 def test_filter_preferences_isolated_and_validated(self):
  maint,other=self.student_account()
  saved=self.call('practice-preferences',{'province':['重庆'],'practiced':['yes']})
  self.assertTrue(all(not v for v in m.dispatch('GET',['practice-preferences'],{'studentId':'legacy-student'},other).values()))
  self.call('practice-preferences',{'province':['四川'],'studentId':'legacy-student'},token=other)
  self.assertEqual(self.call('practice-preferences'),saved)
  for prefs in [{'year':['bad']},{'province':'重庆'},{'wrong':['bad']}]:
   with self.assertRaises(m.Error):self.call('practice-preferences',prefs)
  self.assertEqual(self.call('practice-preferences'),saved)
  with self.assertRaises(m.Error):self.call('practice-preferences',{},token=maint)
 def test_bank_totals_are_disjoint_and_not_chapter_sums(self):
  with m.connection(m.DB) as c:c.execute("update questions set chapters=? where qid='sample#1'",(json.dumps([{'chapter':'第二章 声现象'},{'chapter':'第四章 光现象'}]),))
  o=self.call('overview');bank=o['bank']
  self.assertEqual(bank['total'],3);self.assertEqual(bank['eightOfficial'],3)
  self.assertEqual(sum(ch['count'] for ch in o['chapters']),4)
  self.assertEqual(sum(bank[k] for k in ['eightOfficial','eightMissing','otherNine','unclassified']),bank['total'])
 def test_bank_summary_includes_missing_answers_ninth_grade_and_unknown(self):
  with m.connection(m.DB) as c:
   c.execute("update questions set answerStatus='missing' where qid='sample#1'")
   c.execute("update questions set chapters='[]' where qid='sample#2'")
   c.execute("update questions set chapters=? where qid='sample#3'",(json.dumps([{'grade':'九年级全一册','chapter':'第十八章 电功率'}]),))
  bank=self.call('overview')['bank']
  self.assertEqual((bank['eightOfficial'],bank['eightMissing'],bank['otherNine'],bank['unclassified']),(0,1,1,1))
  self.assertEqual((bank['official'],bank['missing'],bank['papers']),(2,1,1))
 def test_add_missing_figure_slot(self):
  self.unlock();source=self.call('sources',{'qid':'sample#1'})['pages'][0]
  r=self.call('crop',{'qid':'sample#1','figKey':'2','source':source['path'],'box':[.2,.2,.7,.6],'expectedPath':'','expectedHash':None,'expectedVersion':None,'checks':{k:True for k in ['match','complete','scope','readable']}})
  self.assertEqual(r['figures']['2']['matchStatus'],'human_confirmed')

if __name__=='__main__':unittest.main()
