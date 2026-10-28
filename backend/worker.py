"""Durable single-worker ADK pipeline. Queued jobs survive process restarts."""
import asyncio
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from google.adk.agents import BaseAgent, SequentialAgent
from google.adk.events import Event
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from backend.db import connect, project_data
from backend.extraction import extract, chunk_pages
from backend.vectors import index_project, signature

log = logging.getLogger(__name__)


def report(job_id, stage, progress, message):
    with connect() as db:
        row = db.execute('SELECT events FROM jobs WHERE id=?', (job_id,)).fetchone()
        if not row:
            return
        events = json.loads(row['events'])
        events.append({'at': datetime.now(timezone.utc).isoformat(), 'agent': stage, 'message': message})
        db.execute('UPDATE jobs SET stage=?,progress=?,events=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
                   (stage, progress, json.dumps(events[-150:]), job_id))


def ingest_stage(job_id, step):
    with connect() as db:
        job = db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
        source = db.execute('SELECT * FROM sources WHERE id=? AND deleted=0', (job['source_id'],)).fetchone()
    if not source:
        raise ValueError('The source was removed.')
    source_data = json.loads(source['data'])
    report_fn = lambda stage, pct, message: report(job_id, stage, pct, message)
    if step == 'parse':
        pages, note = extract(Path(source['path']), source_data['fileType'], report_fn)
        # A durable intermediate file makes extraction inspectable without exposing server paths to clients.
        Path(source['path'] + '.parsed.json').write_text(json.dumps({'pages': pages, 'note': note}), encoding='utf-8')
        report(job_id, 'Parsing agent', 60, f'Parsed {len(pages)} page(s)/section(s).')
    else:
        parsed = json.loads(Path(source['path'] + '.parsed.json').read_text(encoding='utf-8'))
        chunks = chunk_pages(parsed['pages'], source['id'])
        if not chunks:
            raise ValueError('No readable text was found, including after OCR. Try a clearer image or another document.')
        source_data.update(status='ready', chunks=chunks, extractionNote=parsed['note'])
        source_data.pop('attention', None)
        with connect() as db:
            db.execute('UPDATE sources SET data=? WHERE id=? AND deleted=0', (json.dumps(source_data), source['id']))
        report(job_id, 'Passage curator', 100, f'Prepared {len(chunks)} cited passages. Ready for indexing.')


def index_stage(job_id):
    with connect() as db:
        job = db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
        row = db.execute('SELECT * FROM projects WHERE id=?', (job['project_id'],)).fetchone()
        if not row:
            raise ValueError('Project was removed.')
        project = project_data(db, row)
        user_id = row['user_id']
    report(job_id, 'Indexing agent', 5, 'Connecting to Qdrant and loading the local embedding model.')
    revision, count = index_project(project, user_id, lambda s, p, m: report(job_id, s, p, m))
    with connect() as db:
        latest = db.execute('SELECT * FROM projects WHERE id=?', (project['id'],)).fetchone()
        if not latest or signature(project_data(db, latest)) != revision:
            raise ValueError('Sources changed during indexing. Train again to include the latest information.')
        db.execute('UPDATE projects SET index_revision=? WHERE id=?', (revision, project['id']))
    report(job_id, 'Indexing agent', 100, f'{count} passages indexed in Qdrant. Ready to test.')


class PipelineStage(BaseAgent):
    operation: str

    async def _run_async_impl(self, ctx):
        job_id = ctx.session.state['job_id']
        if self.operation == 'index':
            await asyncio.to_thread(index_stage, job_id)
        else:
            await asyncio.to_thread(ingest_stage, job_id, self.operation)
        yield Event(author=self.name, content=types.Content(parts=[types.Part.from_text(text=f'{self.name} completed')]))


async def run_job(job):
    agents = ([PipelineStage(name='document_reader_and_ocr', operation='parse'),
               PipelineStage(name='passage_curator', operation='chunk')] if job['kind'] == 'ingest' else
              [PipelineStage(name='search_indexer', operation='index')])
    orchestrator = SequentialAgent(name='knowledge_coordinator', sub_agents=agents)
    sessions = InMemorySessionService()
    session = await sessions.create_session(app_name='anvesha_training', user_id=job['project_id'], state={'job_id': job['id']})
    runner = Runner(agent=orchestrator, app_name='anvesha_training', session_service=sessions)
    async for _ in runner.run_async(user_id=job['project_id'], session_id=session.id,
                                   new_message=types.Content(role='user', parts=[types.Part.from_text(text='Prepare this knowledge job.')])):
        pass


class Worker:
    def __init__(self):
        self.stop = threading.Event()
        self.thread = None

    def start(self):
        with connect() as db:
            db.execute("UPDATE jobs SET status='queued', stage='Resuming after restart' WHERE status='running'")
        self.thread = threading.Thread(target=self.loop, daemon=True, name='anvesha-worker')
        self.thread.start()

    def loop(self):
        while not self.stop.is_set():
            with connect() as db:
                db.execute('BEGIN IMMEDIATE')
                row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at,rowid LIMIT 1").fetchone()
                if row:
                    db.execute("UPDATE jobs SET status='running',error=NULL WHERE id=?", (row['id'],))
            if not row:
                self.stop.wait(0.5)
                continue
            job = dict(row)
            try:
                asyncio.run(run_job(job))
                with connect() as db:
                    db.execute("UPDATE jobs SET status='complete',progress=100,stage='Complete',updated_at=CURRENT_TIMESTAMP WHERE id=?", (job['id'],))
            except Exception as exc:
                log.exception('Knowledge job %s failed', job['id'])
                error = str(exc) if isinstance(exc, ValueError) else 'Processing failed. Check the backend logs and retry; ensure Qdrant and OCR are available.'
                report(job['id'], 'Needs attention', 0, error)
                with connect() as db:
                    db.execute("UPDATE jobs SET status='failed',error=? WHERE id=?", (error, job['id']))
                    if job['source_id']:
                        source = db.execute('SELECT data FROM sources WHERE id=?', (job['source_id'],)).fetchone()
                        if source:
                            data = json.loads(source['data'])
                            data.update(status='attention', attention=error, chunks=[])
                            db.execute('UPDATE sources SET data=? WHERE id=?', (json.dumps(data), job['source_id']))

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=5)


def enqueue(db, project_id, kind, source_id=None):
    job_id = uuid4().hex
    db.execute('INSERT INTO jobs(id,project_id,source_id,kind) VALUES (?,?,?,?)', (job_id, project_id, source_id, kind))
    return job_id
