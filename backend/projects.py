import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from backend.auth import current_user
from backend.db import connect, data_dir, project_data
from backend.extraction import EXTENSIONS
from backend.state import owned_project
from backend.vectors import search_project, signature
from backend.worker import enqueue
from backend.answers import (FOLLOW_UP, GroundingError,
    contextual_sources, fallback_questions, grounded_answer,
    limitation, merge_passages, model_name, provider_error, quoted_answer, read_history)

router = APIRouter(prefix='/api/projects')
MAX_UPLOAD = 15 * 1024 * 1024


@router.post('/{project_id}/sources')
async def upload(project_id: str, file: UploadFile = File(...), user=Depends(current_user)):
    from pathlib import Path
    name = Path((file.filename or 'upload').replace('\\', '/')).name
    extension = Path(name).suffix.lower()
    if extension not in EXTENSIONS:
        raise HTTPException(400, 'Use PDF, DOCX, text, CSV, PNG, JPG, WEBP, TIFF or BMP files.')
    content = await file.read(MAX_UPLOAD + 1)
    if not content:
        raise HTTPException(400, 'This file is empty.')
    if len(content) > MAX_UPLOAD:
        raise HTTPException(413, 'Files must be 15 MB or smaller.')
    digest = hashlib.sha256(content).hexdigest()
    with connect() as db:
        owned_project(db, project_id, user['id'])
        for row in db.execute('SELECT data FROM sources WHERE project_id=? AND deleted=0', (project_id,)):
            source = json.loads(row['data'])
            if source.get('hash') == digest:
                raise HTTPException(409, f"This file already exists as {source['title']}.")
        source_id = uuid4().hex
        directory = data_dir() / 'uploads' / user['id'] / project_id
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / (source_id + extension)
        path.write_bytes(content)
        source = {'id': source_id, 'title': Path(name).stem.replace('_', ' ').replace('-', ' '), 'fileName': name,
                  'fileType': EXTENSIONS[extension], 'size': len(content), 'hash': digest, 'status': 'reading',
                  'chunks': [], 'visibility': 'internal', 'origin': 'upload', 'addedAt': datetime.now(timezone.utc).isoformat(),
                  'serverManaged': True}
        db.execute('INSERT INTO sources(id,project_id,path,data) VALUES (?,?,?,?)', (source_id, project_id, str(path), json.dumps(source)))
        job_id = enqueue(db, project_id, 'ingest', source_id)
    return {'source': source, 'jobId': job_id}


@router.get('/{project_id}/processing')
def processing(project_id: str, user=Depends(current_user)):
    with connect() as db:
        row = owned_project(db, project_id, user['id'])
        project = project_data(db, row)
        jobs = []
        for job in db.execute('SELECT * FROM jobs WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100', (project_id,)):
            item = dict(job)
            item['events'] = json.loads(item['events'])
            jobs.append(item)
        return {'sources': project['draft']['sources'], 'jobs': jobs,
                'indexed': bool(row['index_revision']) and row['index_revision'] == signature(project)}


@router.delete('/{project_id}/sources/{source_id}')
def delete_source(project_id: str, source_id: str, user=Depends(current_user)):
    with connect() as db:
        owned_project(db, project_id, user['id'])
        db.execute('UPDATE sources SET deleted=1 WHERE id=? AND project_id=?', (source_id, project_id))
        db.execute("UPDATE jobs SET status='cancelled',stage='Source removed' WHERE source_id=? AND project_id=? AND status='queued'", (source_id, project_id))
    return {'ok': True}


@router.post('/{project_id}/sources/{source_id}/retry')
def retry_source(project_id: str, source_id: str, user=Depends(current_user)):
    with connect() as db:
        owned_project(db, project_id, user['id'])
        row = db.execute('SELECT * FROM sources WHERE id=? AND project_id=? AND deleted=0', (source_id, project_id)).fetchone()
        if not row:
            raise HTTPException(404, 'Source not found.')
        pending = db.execute("SELECT id FROM jobs WHERE source_id=? AND status IN ('queued','running')", (source_id,)).fetchone()
        if pending:
            return {'jobId': pending['id']}
        source = json.loads(row['data'])
        source.update(status='reading', chunks=[])
        source.pop('attention', None)
        db.execute('UPDATE sources SET data=? WHERE id=?', (json.dumps(source), source_id))
        job_id = enqueue(db, project_id, 'ingest', source_id)
    return {'jobId': job_id}


@router.post('/{project_id}/train')
def train(project_id: str, user=Depends(current_user)):
    with connect() as db:
        row = owned_project(db, project_id, user['id'])
        pending = db.execute("SELECT id FROM jobs WHERE project_id=? AND kind='index' AND status IN ('queued','running')", (project_id,)).fetchone()
        if pending:
            return {'jobId': pending['id']}
        job_id = enqueue(db, project_id, 'index')
    return {'jobId': job_id}


class Question(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    engine: str = Field(default='model', pattern='^(model|demo)$')
    conversation_id: str | None = Field(default=None, alias='conversationId', max_length=200)
    message_id: str | None = Field(default=None, alias='messageId', max_length=200)


@router.post('/{project_id}/answer')
async def answer_project(project_id: str, body: Question, request: Request, user=Depends(current_user)):
    # Import here avoids coupling the worker to HTTP routes.
    from backend.app import allow_answer
    allow_answer(user['id'])
    if not body.question.strip():
        raise HTTPException(400, 'A question is required.')
    with connect() as db:
        row = owned_project(db, project_id, user['id'])
        project = project_data(db, row)
        history = read_history(db, project_id, user['id'], body.conversation_id, body.message_id, body.question)
    revision = row['index_revision']
    if not revision or revision != signature(project):
        raise HTTPException(409, 'Your sources need indexing. Open Training and prepare the latest information first.')
    if body.engine == 'model' and not os.getenv('GOOGLE_API_KEY'):
        raise HTTPException(503, 'AI answers are not configured. Add GOOGLE_API_KEY on the backend, or explicitly choose Source quotes. Quotes cannot explain or rewrite your text.')
    query, pinned = contextual_sources(project, body.question, history)
    previous_answer = next((m.get('answer', {}) for m in reversed(history) if m.get('role') == 'assistant' and m.get('answer', {}).get('citations')), {})
    if FOLLOW_UP.search(body.question) and previous_answer.get('citations') and not pinned:
        return limitation('The sources behind that earlier answer have changed. Ask a question about the current sources or start a new conversation.')
    try:
        retrieved = await asyncio.to_thread(search_project, project_id, user['id'], revision, query)
    except Exception:
        if not pinned:
            raise HTTPException(503, 'Search is unavailable. Check that Qdrant is running and retry.')
        retrieved = []
    passages = merge_passages(pinned, retrieved)
    if not passages:
        return limitation('I couldn’t find enough supporting information in your current sources to answer that. Try naming the topic or document.')
    draft = project['draft']
    org = ''
    with connect() as db:
        workspace = db.execute('SELECT data FROM workspaces WHERE id=? AND user_id=?', (project['orgId'], user['id'])).fetchone()
        if workspace:
            org = json.loads(workspace['data'])['name']
    instructions = draft.get('customInstructions') or '\n'.join([
        f"You are {draft.get('name', 'Assistant')} for {org}.", draft.get('purpose', ''), draft.get('behaviour', ''),
        f"Tone: {draft.get('tone', 'friendly')}. Language: {draft.get('language', 'English')}.",
        f"For help contact: {draft.get('handover', {}).get('contact', '')}. {draft.get('handover', {}).get('process', '')}"])
    warnings = []
    used_sources = {p['sourceId'] for p in passages}
    if any(s['id'] in used_sources and (s.get('fileType') == 'Image' or re.search(r'OCR used on [1-9]', s.get('extractionNote', '')))
           for s in draft.get('sources', [])):
        warnings.append('This answer uses OCR text. Check the original image if any word looks wrong or changes the meaning.')
    if body.engine == 'model':
        try:
            answer = await asyncio.wait_for(grounded_answer(body.question, instructions[:20000], passages, history, warnings), 90)
        except GroundingError:
            answer = limitation('I couldn’t support that explanation with the available passages, so I’m not showing an unverified answer. Try a more specific question or inspect the source.',
                                fallback_questions(passages, history, body.question), model=model_name())
            answer['grounding'] = 'rejected'
        except TimeoutError:
            raise HTTPException(504, 'The AI answer and source review timed out. Please retry.')
        except Exception as exc:
            raise provider_error(exc) from None
    else:
        answer = quoted_answer(body.question, passages, history)
    answer['sourceRevision'] = revision
    return answer
