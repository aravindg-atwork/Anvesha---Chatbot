import os
import asyncio
import unittest
import tempfile
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from backend.app import app, hits
from backend.app import AnswerRequest, generate
from backend.db import init_db


class ApiTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        environment = patch.dict(os.environ, {'ANVESHA_DATA_DIR': directory.name, 'ANVESHA_DISABLE_WORKER': '1'})
        environment.start()
        self.addCleanup(environment.stop)
        init_db()
        hits.clear()
        self.client = TestClient(app)
        self.client.post('/api/auth/signup', json={'email': 'owner@example.com', 'name': 'Owner', 'password': 'correct-password'})
        self.body = {'question': 'Leave allowance?', 'instructions': '',
                     'passages': [{'id': 'one', 'label': 'Policy', 'text': '18 days leave.'}]}

    def test_status_never_exposes_key(self):
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'secret'}):
            response = self.client.get('/api/status')
        self.assertTrue(response.json()['modelAvailable'])
        self.assertNotIn('secret', response.text)

    def test_missing_configuration(self):
        with patch.dict(os.environ, {'GOOGLE_API_KEY': ''}):
            self.assertEqual(self.client.post('/api/answer', json=self.body).status_code, 503)

    def test_cross_origin_and_large_requests(self):
        self.assertEqual(self.client.post('/api/answer', json=self.body,
                         headers={'Origin': 'https://other.example'}).status_code, 403)
        self.assertEqual(self.client.post('/api/answer', content='x' * 200001).status_code, 413)

    def test_validation(self):
        self.body['passages'][0]['text'] = 'x' * 6001
        self.assertEqual(self.client.post('/api/answer', json=self.body).status_code, 422)

    def test_answer_and_rate_limit(self):
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'test'}), patch(
                'backend.app.generate', new=AsyncMock(return_value='18 days. [S1]')) as generate:
            for _ in range(20):
                response = self.client.post('/api/answer', json=self.body)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['text'], '18 days. [S1]')
            self.assertEqual(self.client.post('/api/answer', json=self.body).status_code, 429)
            self.assertEqual(generate.await_count, 20)

    def test_provider_failure_hides_details(self):
        with patch.dict(os.environ, {'GOOGLE_API_KEY': 'test'}), patch(
                'backend.app.generate', new=AsyncMock(side_effect=RuntimeError('private detail'))):
            response = self.client.post('/api/answer', json=self.body)
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('private detail', response.text)

    def test_adk_runner_receives_sources_and_cleans_session(self):
        captured = {}

        class FakeRunner:
            def __init__(self, **kwargs):
                captured.update(kwargs)

            async def run_async(self, **kwargs):
                captured.update(kwargs)
                yield SimpleNamespace(is_final_response=lambda: True,
                    content=SimpleNamespace(parts=[SimpleNamespace(text='18 days. [S1]', thought=False)]))

        with patch('backend.app.Runner', FakeRunner):
            result = asyncio.run(generate(AnswerRequest(**self.body)))
        self.assertEqual(result, '18 days. [S1]')
        self.assertEqual(captured['agent'].name, 'knowledge_assistant')
        self.assertIn('18 days leave.', captured['new_message'].parts[0].text)
        remaining = asyncio.run(captured['session_service'].get_session(
            app_name='anvesha', user_id=captured['user_id'], session_id=captured['session_id']))
        self.assertIsNone(remaining)


if __name__ == '__main__':
    unittest.main()
