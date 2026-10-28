import copy
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from figure_slots import audit, normalize_question, slots, valid_keys


class FigureSlotsTest(unittest.TestCase):
    def test_variants_options_and_recursive_subquestions(self):
        q = {'stem': '实验 {{fig:2：电路图}}',
             'options': [{'text': 'A图所示', 'hasFigure': True}],
             'subQuestions': [{'stem': '如图所示', 'subQuestions': [
                 {'stem': '图17和图18比较'}]}], 'answerText': '答案见图19'}
        result = normalize_question(copy.deepcopy(q))
        self.assertEqual(len(slots(result)), 6)
        self.assertIn('{{fig:2}}（电路图）', result['stem'])
        self.assertEqual(result, normalize_question(copy.deepcopy(result)))

    def test_variant_description_with_latex_braces(self):
        q = normalize_question({'stem': r'如图8 {{fig:1：电阻 $R_{0}$ 的电路图}}'})
        self.assertIn('{{fig:1}}', q['stem'])
        self.assertIn('$R_{0}$', q['stem'])
        self.assertEqual(q, normalize_question(copy.deepcopy(q)))

    def test_generic_reference_and_number_are_one_slot(self):
        q = normalize_question({'stem': '如图所示，图17的电流是多少？'})
        self.assertEqual(len(slots(q)), 1)

    def test_no_false_slot_for_graph_or_drawing_words(self):
        q = normalize_question({'stem': '描述图像、图形与作图方法'})
        self.assertFalse(slots(q))

    def test_option_flag_and_existing_keys(self):
        q = normalize_question({'stem': '无图题干', 'options': [
            {'text': '', 'hasFigure': True}]}, existing={'9'})
        self.assertEqual(slots(q), {'10'})

    def test_actual_keys_and_missing_files_not_counts(self):
        with tempfile.TemporaryDirectory() as tmp:
            bank = Path(tmp)
            (bank / 'ok.png').write_bytes(b'image')
            db = sqlite3.connect(':memory:')
            db.row_factory = sqlite3.Row
            db.executescript('CREATE TABLE questions(qid TEXT,stem TEXT,options TEXT,subQuestions TEXT);'
                             'CREATE TABLE figures(qid TEXT,figKey TEXT,imagePath TEXT);')
            db.execute('INSERT INTO questions VALUES(?,?,?,?)',
                       ('q', '{{fig:1}}{{fig:2}}', '[]', '[]'))
            db.executemany('INSERT INTO figures VALUES(?,?,?)',
                           [('q', '1', 'ok.png'), ('q', '2', 'missing.png'),
                            ('q', '3', 'ok.png')])
            self.assertEqual(valid_keys(db, 'q', bank), {'1', '3'})
            report = audit(db, bank)
            self.assertEqual(report['missingSlots'], 1)
            self.assertEqual(report['questions'][0]['missingKeys'], ['2'])


if __name__ == '__main__':
    unittest.main()
