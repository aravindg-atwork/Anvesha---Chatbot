import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from backend.auth import current_user, session_for
from backend.db import connect, project_data

router = APIRouter(prefix='/api')


def owned_project(db, project_id, user_id):
    row = db.execute('SELECT * FROM projects WHERE id=? AND user_id=?', (project_id, user_id)).fetchone()
    if not row:
        raise HTTPException(404, 'Project not found.')
    return row


def read_state(db, user):
    account = db.execute('SELECT * FROM accounts WHERE user_id=?', (user['id'],)).fetchone()
    state = {'schemaVersion': 2, 'session': session_for(user), 'orgs': [], 'assistants': [],
             'conversations': [], 'modelPreference': 'model'}
    state.update(json.loads(account['preferences']))
    state['orgs'] = [json.loads(r['data']) for r in db.execute('SELECT data FROM workspaces WHERE user_id=?', (user['id'],))]
    state['assistants'] = [project_data(db, r) for r in db.execute('SELECT * FROM projects WHERE user_id=?', (user['id'],))]
    state['conversations'] = [json.loads(r['data']) for r in db.execute('SELECT data FROM conversations WHERE user_id=?', (user['id'],))]
    return {'state': state, 'revision': account['revision']}


@router.get('/state')
def get_state(user=Depends(current_user)):
    with connect() as db:
        return read_state(db, user)


class StateWrite(BaseModel):
    state: dict
    revision: int = Field(ge=0)


@router.put('/state')
def save_state(body: StateWrite, user=Depends(current_user)):
    state = body.state
    if state.get('schemaVersion') != 2 or any(not isinstance(state.get(k), list) for k in ('orgs', 'assistants', 'conversations')):
        raise HTTPException(400, 'Invalid workspace data.')
    if len(state['assistants']) > 100 or len(state['orgs']) > 50:
        raise HTTPException(400, 'Too many projects or workspaces.')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        revision = db.execute('SELECT revision FROM accounts WHERE user_id=?', (user['id'],)).fetchone()['revision']
        if revision != body.revision:
            raise HTTPException(409, 'Your data changed in another tab. Reload before editing further.')
        org_ids = {o.get('id') for o in state['orgs']}
        project_ids = {a.get('id') for a in state['assistants']}
        for items, table in ((state['orgs'], 'workspaces'), (state['assistants'], 'projects'), (state['conversations'], 'conversations')):
            for item in items:
                if not isinstance(item.get('id'), str) or len(item['id']) > 200:
                    raise HTTPException(400, 'Invalid record ID.')
                existing = db.execute(f'SELECT user_id FROM {table} WHERE id=?', (item['id'],)).fetchone()
                if existing and existing['user_id'] != user['id']:
                    raise HTTPException(409, 'That record ID is already in use.')
                if table == 'workspaces':
                    if not str(item.get('name', '')).strip():
                        raise HTTPException(400, 'Workspace name is required.')
                    db.execute('INSERT INTO workspaces VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
                               (item['id'], user['id'], json.dumps(item)))
                elif table == 'projects':
                    if item.get('orgId') not in org_ids or not isinstance(item.get('draft'), dict):
                        raise HTTPException(400, 'A project must belong to your workspace.')
                    if not str(item['draft'].get('name', '')).strip():
                        raise HTTPException(400, 'Project name is required.')
                    db.execute('INSERT INTO projects(id,user_id,workspace_id,data) VALUES (?,?,?,?) '
                               'ON CONFLICT(id) DO UPDATE SET workspace_id=excluded.workspace_id,data=excluded.data',
                               (item['id'], user['id'], item['orgId'], json.dumps(item)))
                    from backend.worker import enqueue_index_when_settled
                    enqueue_index_when_settled(db, item['id'])
                else:
                    if item.get('assistantId') not in project_ids:
                        raise HTTPException(400, 'Conversation project not found.')
                    db.execute('INSERT INTO conversations VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
                               (item['id'], user['id'], item['assistantId'], json.dumps(item)))
        # Delete only records owned by this account. Source files are retained for recovery.
        for table, ids in (('conversations', {c['id'] for c in state['conversations']}), ('projects', project_ids), ('workspaces', org_ids)):
            for row in db.execute(f'SELECT id FROM {table} WHERE user_id=?', (user['id'],)).fetchall():
                if row['id'] not in ids:
                    db.execute(f'DELETE FROM {table} WHERE id=? AND user_id=?', (row['id'], user['id']))
        preference = state.get('modelPreference', 'model')
        db.execute('UPDATE accounts SET revision=revision+1, preferences=? WHERE user_id=?',
                   (json.dumps({'modelPreference': preference if preference in ('demo', 'model') else 'model'}), user['id']))
        return {'revision': revision + 1}
