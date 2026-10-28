import tempfile
import unittest
from pathlib import Path

import review_workbench as workbench


class AcceptanceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = workbench.OUT, workbench.RECORDS
        workbench.OUT = Path(self.tmp.name)
        workbench.RECORDS = workbench.OUT / 'records.json'
        self.item = {'id': 'test', 'qid': 'sample#1', 'figKey': '2',
                     'fingerprint': 'current', 'original': 'image', 'candidate': None}
        self.value = {'fingerprint': 'current', 'decision': 'pass', 'target': 'original',
                      'note': 'checked', 'checks': {k: True for k in ('match', 'complete', 'scope', 'readable')}}

    def tearDown(self):
        workbench.OUT, workbench.RECORDS = self.old
        self.tmp.cleanup()

    def test_save_survives_reload_and_can_undo(self):
        workbench.save_record(self.item, self.value)
        self.assertEqual(workbench.load_records()['test']['decision'], 'pass')
        self.value['decision'] = 'pending'
        workbench.save_record(self.item, self.value)
        self.assertEqual(workbench.load_records()['test']['decision'], 'pending')

    def test_cannot_pass_incomplete_checks(self):
        self.value['checks']['complete'] = False
        with self.assertRaises(ValueError):
            workbench.save_record(self.item, self.value)

    def test_cannot_save_stale_image_version(self):
        self.value['fingerprint'] = 'old'
        with self.assertRaises(ValueError):
            workbench.save_record(self.item, self.value)

    def test_cannot_accept_missing_candidate(self):
        self.value['target'] = 'candidate'
        with self.assertRaises(ValueError):
            workbench.save_record(self.item, self.value)


if __name__ == '__main__':
    unittest.main()
