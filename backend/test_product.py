"""Account, persistence, isolation, ingestion and ADK orchestration regression tests."""
import asyncio
import io
import json
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from PIL import Image
from qdrant_client import QdrantClient

from backend.app import app, hits
from backend.auth import attempts
from backend.db import init_db, connect
from backend.worker import run_job, Worker


def initial_state():
    return {'schemaVersion': 2, 'orgs': [{'id': 'workspace-one', 'name': 'My workspace', 'isSample': False}],
            'assistants': [{'id': 'project-one', 'orgId': 'workspace-one', 'draft': {'name': 'Policy Helper',
                'sources': [], 'faqs': [], 'conflicts': []}}], 'conversations': [], 'modelPreference': 'demo'}


def fake_embed(texts, query=False):
    # Tests isolate DB/filter behavior from the downloaded neural model.
    return [[1.0] + [0.0] * 383 for _ in texts]


class ProductTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        environment = patch.dict(os.environ, {'ANVESHA_DATA_DIR': directory.name, 'ANVESHA_DISABLE_WORKER': '1', 'GOOGLE_API_KEY': ''})
        environment.start()
        self.addCleanup(environment.stop)
        init_db()
        hits.clear()
        attempts.clear()
        self.client = TestClient(app)
        response = self.client.post('/api/auth/signup', json={'email': 'alice@example.com', 'name': 'Alice', 'password': 'correct-password'})
        self.assertEqual(response.status_code, 200, response.text)
        self.state = initial_state()
        self.save()

    def save(self, revision=None):
        revision = self.client.get('/api/state').json()['revision'] if revision is None else revision
        response = self.client.put('/api/state', json={'state': self.state, 'revision': revision})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['revision']

    def upload(self, name='policy.txt', content=b'Employees receive eighteen days of annual leave per year.'):
        response = self.client.post('/api/projects/project-one/sources', files={'file': (name, content)})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def run_job_id(self, job_id):
        with connect() as db:
            job = dict(db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone())
        asyncio.run(run_job(job))
        with connect() as db:
            db.execute("UPDATE jobs SET status='complete' WHERE id=?", (job_id,))

    def test_password_sessions_and_revocation(self):
        with connect() as db:
            stored = db.execute('SELECT password FROM users').fetchone()['password']
        self.assertNotIn('correct-password', stored)
        token = self.client.cookies.get('anvesha_session')
        self.client.post('/api/auth/signout')
        self.assertEqual(self.client.get('/api/state').status_code, 401)
        self.client.cookies.set('anvesha_session', token)
        self.assertEqual(self.client.get('/api/state').status_code, 401)
        self.client.cookies.clear()
        response = self.client.post('/api/auth/signin', json={'email': 'alice@example.com', 'password': 'wrong-password'})
        self.assertEqual(response.status_code, 401)
        response = self.client.post('/api/auth/signin', json={'email': 'ALICE@example.com', 'password': 'correct-password'})
        self.assertEqual(response.status_code, 200)
        self.assertIn('HttpOnly', response.headers['set-cookie'])
        self.assertEqual(self.client.get('/api/state').json()['state']['orgs'][0]['name'], 'My workspace')

    def test_revision_conflicts_do_not_overwrite_data(self):
        response = self.client.put('/api/state', json={'state': self.state, 'revision': 0})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.get('/api/state').json()['revision'], 1)

    def test_account_isolation_including_record_id_collision(self):
        self.upload()
        other = TestClient(app)
        other.post('/api/auth/signup', json={'email': 'bob@example.com', 'name': 'Bob', 'password': 'other-password'})
        self.assertEqual(other.get('/api/state').json()['state']['assistants'], [])
        for suffix in ('processing',):
            self.assertEqual(other.get(f'/api/projects/project-one/{suffix}').status_code, 404)
        self.assertEqual(other.post('/api/projects/project-one/train').status_code, 404)
        self.assertEqual(other.post('/api/projects/project-one/answer', json={'question': 'leave?'}).status_code, 404)
        self.assertEqual(other.post('/api/projects/project-one/sources', files={'file': ('secret.txt', b'text')}).status_code, 404)
        self.assertEqual(other.put('/api/state', json={'state': self.state, 'revision': 0}).status_code, 409)

    def test_upload_validation_duplicates_and_removal(self):
        result = self.upload()
        response = self.client.post('/api/projects/project-one/sources', files={'file': ('again.txt', b'Employees receive eighteen days of annual leave per year.')})
        self.assertEqual(response.status_code, 409)
        for name, content, code in [('bad.exe', b'bad', 400), ('empty.txt', b'', 400), ('huge.txt', b'x' * (15 * 1024 * 1024 + 1), 413)]:
            self.assertEqual(self.client.post('/api/projects/project-one/sources', files={'file': (name, content)}).status_code, code)
        source_id = result['source']['id']
        self.assertEqual(self.client.delete(f'/api/projects/project-one/sources/{source_id}').status_code, 200)
        self.assertEqual(self.client.get('/api/projects/project-one/processing').json()['sources'], [])

    def test_pipeline_indexes_and_queries_only_current_sources(self):
        upload = self.upload()
        self.run_job_id(upload['jobId'])
        processing = self.client.get('/api/projects/project-one/processing').json()
        self.assertEqual(processing['sources'][0]['status'], 'ready')
        self.assertIn('eighteen', processing['sources'][0]['chunks'][0]['text'])
        qdrant = QdrantClient(':memory:')
        self.addCleanup(qdrant.close)
        with patch('backend.vectors.client', return_value=qdrant), patch('backend.vectors.embed', side_effect=fake_embed):
            job_id = self.client.post('/api/projects/project-one/train').json()['jobId']
            self.run_job_id(job_id)
            self.assertTrue(self.client.get('/api/projects/project-one/processing').json()['indexed'])
            response = self.client.post('/api/projects/project-one/answer', json={'question': 'annual leave allowance?', 'engine': 'demo'})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn('eighteen', response.json()['text'])
            self.assertEqual(response.json()['citations'][0]['sourceId'], upload['source']['id'])
            self.client.delete(f"/api/projects/project-one/sources/{upload['source']['id']}")
            self.assertEqual(self.client.post('/api/projects/project-one/answer', json={'question': 'leave?'}).status_code, 409)

    def test_image_ocr_is_part_of_adk_ingestion(self):
        data = io.BytesIO()
        Image.new('RGB', (200, 200), 'white').save(data, format='PNG')
        upload = self.upload('notice.png', data.getvalue())
        with patch('backend.extraction.ocr', return_value='Office opening hours are 9 am to 6 pm.') as ocr:
            self.run_job_id(upload['jobId'])
        self.assertEqual(ocr.call_count, 1)
        result = self.client.get('/api/projects/project-one/processing').json()
        source = result['sources'][0]
        self.assertEqual(source['fileType'], 'Image')
        self.assertIn('9 am', source['chunks'][0]['text'])
        self.assertTrue(any(e['agent'] == 'OCR agent' for e in result['jobs'][0]['events']))

    def test_server_extraction_cannot_be_overwritten_by_state_save(self):
        upload = self.upload()
        self.run_job_id(upload['jobId'])
        self.state = self.client.get('/api/state').json()['state']
        self.state['assistants'][0]['draft']['sources'][0]['chunks'] = [{'text': 'forged'}]
        self.save()
        restored = self.client.get('/api/state').json()['state']['assistants'][0]['draft']['sources'][0]
        self.assertIn('eighteen', restored['chunks'][0]['text'])

    def test_worker_recovers_jobs_on_restart(self):
        upload = self.upload()
        with connect() as db:
            db.execute("UPDATE jobs SET status='running' WHERE id=?", (upload['jobId'],))
        worker = Worker()
        with patch.object(worker, 'loop'):
            worker.start()
            worker.close()
        with connect() as db:
            self.assertEqual(db.execute('SELECT status FROM jobs WHERE id=?', (upload['jobId'],)).fetchone()['status'], 'queued')

    def test_model_mode_never_silently_falls_back_to_quotes(self):
        uploaded = self.upload()
        self.run_job_id(uploaded['jobId'])
        qdrant = QdrantClient(':memory:')
        self.addCleanup(qdrant.close)
        with patch('backend.vectors.client', return_value=qdrant), patch('backend.vectors.embed', side_effect=fake_embed):
            self.run_job_id(self.client.post('/api/projects/project-one/train').json()['jobId'])
            response = self.client.post('/api/projects/project-one/answer', json={'question': 'annual leave?', 'engine': 'model'})
        self.assertEqual(response.status_code, 503)
        self.assertIn('not configured', response.json()['error'])

    def test_retry_context_stops_at_the_original_question(self):
        from backend.answers import read_history
        self.state['conversations'] = [{'id': 'conv-one', 'assistantId': 'project-one', 'messages': [
            {'id': 'm1', 'role': 'user', 'text': 'Earlier question'},
            {'id': 'm2', 'role': 'assistant', 'text': 'Earlier answer'},
            {'id': 'm3', 'role': 'user', 'text': 'Explain this'},
            {'id': 'm4', 'role': 'assistant', 'text': 'Future answer must be excluded'}]}]
        self.save()
        with connect() as db:
            user_id = db.execute('SELECT id FROM users').fetchone()['id']
            history = read_history(db, 'project-one', user_id, 'conv-one', 'm3', 'Explain this')
            self.assertEqual([m['id'] for m in history], ['m1', 'm2'])
            with self.assertRaises(Exception) as error:
                read_history(db, 'another-project', user_id, 'conv-one', 'm3', 'Explain this')
            self.assertEqual(error.exception.status_code, 404)


if __name__ == '__main__':
    unittest.main()
