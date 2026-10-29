"""Per-account read-only Google Drive import, durable sync and access checks."""
import base64
import hashlib
import json
import os
import re
import secrets
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, quote
from uuid import uuid4

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from backend.auth import COOKIE, current_user
from backend.db import connect, data_dir
from backend.extraction import EXTENSIONS
from backend.state import owned_project

router = APIRouter(prefix='/api/drive')
API = 'https://www.googleapis.com/drive/v3/'
SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
FOLDER = 'application/vnd.google-apps.folder'
EXPORTS = {
    'application/vnd.google-apps.document': ('.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    'application/vnd.google-apps.spreadsheet': ('.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    'application/vnd.google-apps.presentation': ('.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
}
FIELDS = 'id,name,mimeType,size,modifiedTime,version,md5Checksum,parents,trashed,capabilities(canDownload),webViewLink,driveId'
MAX_ITEMS = 1000


def configured():
    return bool(os.getenv('GOOGLE_OAUTH_CLIENT_ID') and os.getenv('GOOGLE_OAUTH_CLIENT_SECRET') and os.getenv('GOOGLE_OAUTH_REDIRECT_URI'))


def cipher():
    configured_key = os.getenv('ANVESHA_TOKEN_KEY')
    if configured_key:
        return Fernet(configured_key.encode())
    # The single-machine pilot persists a separate key so restarts do not lose access.
    path = data_dir() / '.drive-token-key'
    try:
        with path.open('xb') as output:
            os.chmod(path, 0o600)
            output.write(Fernet.generate_key())
    except FileExistsError:
        pass
    return Fernet(path.read_bytes())


def encrypt(value):
    return cipher().encrypt(json.dumps(value).encode()).decode()


def decrypt(value):
    return json.loads(cipher().decrypt(value.encode()))


def connection(user_id):
    with connect() as db:
        row = db.execute('SELECT * FROM drive_connections WHERE user_id=? AND active=1', (user_id,)).fetchone()
    if not row:
        raise HTTPException(409, 'Connect Google Drive before importing files.')
    return dict(row)


def provider_request(method, url, **kwargs):
    # URLs are always constructed by this module, never accepted from documents or clients.
    for attempt in range(3):
        try:
            response = httpx.request(method, url, timeout=35, follow_redirects=False, **kwargs)
        except httpx.RequestError:
            raise HTTPException(503, 'Google Drive could not be reached. Retry shortly.') from None
        if response.status_code not in (429, 500, 502, 503, 504) or attempt == 2:
            return response
        time.sleep(.4 * 2 ** attempt + secrets.randbelow(100) / 500)
    raise HTTPException(503, 'Google Drive is temporarily unavailable.')


def access_token(user_id):
    row = connection(user_id)
    try:
        credentials = decrypt(row['credentials'])
    except Exception:
        raise HTTPException(409, 'The Drive connection key changed. Reconnect your Google account.') from None
    if credentials.get('expires', 0) > time.time() + 60:
        return credentials['access_token']
    response = provider_request('POST', 'https://oauth2.googleapis.com/token', data={
        'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID'), 'client_secret': os.getenv('GOOGLE_OAUTH_CLIENT_SECRET'),
        'grant_type': 'refresh_token', 'refresh_token': credentials.get('refresh_token')})
    if response.status_code != 200:
        if response.status_code in (400, 401):
            disable_connection(user_id)
        raise HTTPException(409, 'Google authorization expired or was revoked. Reconnect Google Drive.')
    fresh = response.json()
    credentials.update(access_token=fresh['access_token'], expires=time.time() + fresh.get('expires_in', 3600))
    with connect() as db:
        db.execute('UPDATE drive_connections SET credentials=? WHERE user_id=? AND active=1', (encrypt(credentials), user_id))
    return credentials['access_token']


def drive_get(user_id, route, params=None):
    response = provider_request('GET', API + route, params=params, headers={'Authorization': 'Bearer ' + access_token(user_id)})
    if response.status_code == 401:
        disable_connection(user_id)
        raise HTTPException(409, 'Google authorization was revoked. Reconnect Google Drive.')
    if response.status_code in (403, 404):
        raise HTTPException(response.status_code, 'This Drive item is unavailable or access was denied.')
    if response.status_code != 200:
        raise HTTPException(503, 'Google Drive returned an error. Retry or reconnect your account.')
    return response.json()


def metadata(user_id, file_id):
    return drive_get(user_id, 'files/' + quote(file_id, safe=''), {'fields': FIELDS, 'supportsAllDrives': 'true'})


def children(user_id, parent, token=None, folders_only=False):
    if not re.fullmatch(r'[\w-]{1,200}', parent):
        raise HTTPException(400, 'Invalid Drive folder ID.')
    query = f"'{parent}' in parents and trashed = false"
    if folders_only:
        query += f" and mimeType = '{FOLDER}'"
    return drive_get(user_id, 'files', {'q': query, 'fields': f'nextPageToken,files({FIELDS})', 'pageSize': 100,
        'pageToken': token, 'orderBy': 'folder,name', 'spaces': 'drive', 'includeItemsFromAllDrives': 'false'})


def safe_segment(name):
    return re.sub(r'[^\w .()-]', '_', name).strip(' .')[:60].rstrip(' .') or 'Untitled folder'


class ImportConfig(BaseModel):
    projectId: str = Field(max_length=200)
    folderIds: list[str] = Field(min_length=1, max_length=10)
    destination: str = Field(default='', max_length=180)
    recursive: bool = True
    excludedIds: list[str] = Field(default_factory=list, max_length=1000)
    mediaConsent: bool = False
    autoSync: bool = False


def validate_config(config):
    from backend.projects import folder_path
    config.destination = folder_path(config.destination)
    if len(config.destination.split('/')) > 5:
        raise HTTPException(400, 'Choose a destination up to 5 levels deep to leave room for Drive subfolders.')
    if any(not re.fullmatch(r'[\w-]{1,200}', file_id) for file_id in config.folderIds + config.excludedIds):
        raise HTTPException(400, 'Invalid Drive item ID.')


def inventory(user_id, config):
    validate_config(config)
    queue, seen, items, folders = [], set(), [], []
    excluded = set(config.excludedIds)
    for file_id in config.folderIds:
        folder = metadata(user_id, file_id)
        if folder.get('mimeType') != FOLDER or folder.get('trashed') or folder.get('driveId'):
            raise HTTPException(400, 'Choose a folder in My Drive. Shared Drives are not supported in this release.')
        path = '/'.join(filter(None, [config.destination, safe_segment(folder['name'])]))
        queue.append((file_id, path))
    while queue:
        parent, path = queue.pop(0)
        if parent in seen or parent in excluded:
            continue
        seen.add(parent)
        if len(seen) > MAX_ITEMS or len(path) > 240 or len(path.split('/')) > 10:
            raise HTTPException(400, 'This selection exceeds 1,000 folders, 10 folder levels or 240 path characters. Choose a smaller selection.')
        folders.append(path)
        token = None
        while True:
            page = children(user_id, parent, token)
            for file in page.get('files', []):
                if file['id'] in excluded:
                    continue
                if file['mimeType'] == FOLDER:
                    if config.recursive:
                        queue.append((file['id'], path + '/' + safe_segment(file['name'])))
                    continue
                ext, export_mime = EXPORTS.get(file['mimeType'], (Path(file['name']).suffix.lower(), None))
                kind = EXTENSIONS.get(ext)
                reason = None
                if not kind:
                    reason = 'Unsupported file type (shortcuts are not followed).'
                elif file.get('capabilities', {}).get('canDownload') is False:
                    reason = 'Downloading is disabled by the owner.'
                elif int(file.get('size', 0)) > (10 if kind in ('Audio', 'Video') else 15) * 1024 * 1024:
                    reason = 'Exceeds the file size limit.'
                elif kind in ('Audio', 'Video') and not config.mediaConsent:
                    reason = 'Cloud transcription consent is required.'
                elif kind in ('Audio', 'Video') and not os.getenv('GOOGLE_API_KEY'):
                    reason = 'Configure a Gemini API key for transcription.'
                items.append({**file, 'folderPath': path, 'extension': ext, 'exportMime': export_mime, 'fileType': kind or 'Other', 'skipReason': reason})
                if len(items) > MAX_ITEMS:
                    raise HTTPException(400, 'Import previews are limited to 1,000 files. Choose smaller folders.')
            token = page.get('nextPageToken')
            if not token:
                break
    # Overlapping folder selections must never create duplicate sources.
    return list({item['id']: item for item in items}.values()), sorted(set(folders))


@router.get('/status')
def status(projectId: str | None = None, user=Depends(current_user)):
    with connect() as db:
        row = db.execute('SELECT email,active FROM drive_connections WHERE user_id=?', (user['id'],)).fetchone()
        link = None
        if projectId:
            owned_project(db, projectId, user['id'])
            saved = db.execute('SELECT * FROM drive_links WHERE project_id=?', (projectId,)).fetchone()
            if saved:
                link = {'config': json.loads(saved['config']), 'lastSync': saved['last_sync'], 'error': saved['error'], 'summary': json.loads(saved['summary'])}
        return {'configured': configured(), 'connected': bool(row and row['active']), 'email': row['email'] if row else None, 'link': link}


class ConnectRequest(BaseModel):
    projectId: str = Field(max_length=200)


@router.post('/connect')
def begin(body: ConnectRequest, request: Request, user=Depends(current_user)):
    if not configured():
        raise HTTPException(503, 'Configure GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI on the server.')
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(48)
    digest = hashlib.sha256(request.cookies.get(COOKIE, '').encode()).hexdigest()
    with connect() as db:
        owned_project(db, body.projectId, user['id'])
        db.execute('DELETE FROM drive_oauth_states WHERE expires<?', (int(time.time()),))
        db.execute('INSERT INTO drive_oauth_states VALUES (?,?,?,?,?,?)',
            (hashlib.sha256(state.encode()).hexdigest(), user['id'], digest, body.projectId, verifier, int(time.time()) + 600))
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urlencode({'client_id': os.environ['GOOGLE_OAUTH_CLIENT_ID'],
        'redirect_uri': os.environ['GOOGLE_OAUTH_REDIRECT_URI'], 'response_type': 'code', 'scope': SCOPE,
        'access_type': 'offline', 'prompt': 'consent', 'state': state, 'code_challenge': challenge, 'code_challenge_method': 'S256'})
    response = JSONResponse({'url': url})
    response.set_cookie('anvesha_drive_oauth', state, max_age=600, httponly=True, samesite='lax', secure=os.getenv('COOKIE_SECURE', 'false').lower() == 'true', path='/api/drive')
    return response


@router.get('/callback')
def callback(request: Request, state: str = '', code: str = '', error: str = ''):
    cookie = request.cookies.get('anvesha_drive_oauth', '')
    if not state or not cookie or not secrets.compare_digest(state, cookie):
        raise HTTPException(400, 'The Google connection request expired. Start again from Anvesha.')
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        saved = db.execute('SELECT * FROM drive_oauth_states WHERE state=? AND expires>?', (hashlib.sha256(state.encode()).hexdigest(), int(time.time()))).fetchone()
        if not saved or not db.execute('SELECT 1 FROM sessions WHERE token_hash=? AND user_id=? AND expires>?', (saved['session_hash'], saved['user_id'], int(time.time()))).fetchone():
            raise HTTPException(400, 'The Google connection session expired. Sign in and reconnect.')
        db.execute('DELETE FROM drive_oauth_states WHERE state=?', (saved['state'],))
    redirect = f"/#/p/{quote(saved['project_id'], safe='')}/upload"
    if error or not code:
        return RedirectResponse(redirect + '?drive=cancelled', status_code=303)
    response = provider_request('POST', 'https://oauth2.googleapis.com/token', data={'code': code, 'code_verifier': saved['verifier'],
        'client_id': os.environ['GOOGLE_OAUTH_CLIENT_ID'], 'client_secret': os.environ['GOOGLE_OAUTH_CLIENT_SECRET'],
        'redirect_uri': os.environ['GOOGLE_OAUTH_REDIRECT_URI'], 'grant_type': 'authorization_code'})
    if response.status_code != 200:
        raise HTTPException(400, 'Google authorization could not be completed. Start the connection again.')
    tokens = response.json()
    if SCOPE not in tokens.get('scope', '').split() or not tokens.get('refresh_token'):
        raise HTTPException(400, 'Allow read-only Drive access and offline authorization to connect.')
    about = provider_request('GET', API + 'about', params={'fields': 'user(emailAddress)'}, headers={'Authorization': 'Bearer ' + tokens['access_token']})
    if about.status_code != 200:
        raise HTTPException(400, 'Enable the Google Drive API for this OAuth client, then retry.')
    email = about.json().get('user', {}).get('emailAddress', 'Google account')
    # A different account cannot silently become the backing store of existing Drive roots.
    with connect() as db:
        old = db.execute('SELECT email FROM drive_connections WHERE user_id=?', (saved['user_id'],)).fetchone()
    if old and old['email'] != email:
        disable_connection(saved['user_id'])
        with connect() as db:
            db.execute('DELETE FROM drive_links WHERE user_id=?', (saved['user_id'],))
    tokens['expires'] = time.time() + tokens.get('expires_in', 3600)
    with connect() as db:
        db.execute('INSERT INTO drive_connections VALUES (?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET credentials=excluded.credentials,email=excluded.email,active=1',
            (saved['user_id'], encrypt(tokens), email))
    result = RedirectResponse(redirect + '?drive=connected', status_code=303)
    result.delete_cookie('anvesha_drive_oauth', path='/api/drive')
    return result


@router.get('/folders')
def folders(parent: str = 'root', pageToken: str | None = None, user=Depends(current_user)):
    return children(user['id'], parent, pageToken, folders_only=True)


@router.post('/preview')
def preview(body: ImportConfig, user=Depends(current_user)):
    with connect() as db:
        owned_project(db, body.projectId, user['id'])
    items, paths = inventory(user['id'], body)
    # Provider tokens are never part of preview or source metadata.
    return {'items': [{k: item.get(k) for k in ('id', 'name', 'fileType', 'size', 'folderPath', 'skipReason')} for item in items],
            'folders': len(paths), 'total': len(items), 'supported': sum(not item['skipReason'] for item in items),
            'types': dict(Counter(item['fileType'] for item in items))}


def enqueue_sync(db, project_id):
    from backend.worker import enqueue
    pending = db.execute("SELECT id FROM jobs WHERE project_id=? AND kind='drive_sync' AND status IN ('queued','running')", (project_id,)).fetchone()
    return pending['id'] if pending else enqueue(db, project_id, 'drive_sync')


@router.post('/import')
def start_import(body: ImportConfig, user=Depends(current_user)):
    validate_config(body)
    connection(user['id'])
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        owned_project(db, body.projectId, user['id'])
        if db.execute("SELECT 1 FROM jobs WHERE project_id=? AND kind='drive_sync' AND status IN ('queued','running')", (body.projectId,)).fetchone():
            raise HTTPException(409, 'A Drive sync is already queued or running. Wait before changing the folder selection.')
        db.execute('INSERT INTO drive_links(project_id,user_id,config) VALUES (?,?,?) ON CONFLICT(project_id) DO UPDATE SET config=excluded.config,error=NULL', (body.projectId, user['id'], body.model_dump_json()))
        return {'jobId': enqueue_sync(db, body.projectId)}


@router.post('/sync/{project_id}')
def sync(project_id: str, user=Depends(current_user)):
    connection(user['id'])
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        owned_project(db, project_id, user['id'])
        if not db.execute('SELECT 1 FROM drive_links WHERE project_id=?', (project_id,)).fetchone():
            raise HTTPException(400, 'Choose Drive folders before syncing.')
        return {'jobId': enqueue_sync(db, project_id)}


def disable_connection(user_id):
    with connect() as db:
        db.execute('UPDATE drive_connections SET active=0,credentials=? WHERE user_id=?', ('', user_id))
        db.execute('UPDATE sources SET deleted=1 WHERE id IN (SELECT i.source_id FROM drive_items i JOIN projects p ON p.id=i.project_id WHERE p.user_id=?)', (user_id,))
        db.execute("UPDATE jobs SET status='cancelled' WHERE kind='drive_sync' AND status='queued' AND project_id IN (SELECT id FROM projects WHERE user_id=?)", (user_id,))


@router.delete('/connection')
def disconnect(user=Depends(current_user)):
    row = connection(user['id'])
    tokens = decrypt(row['credentials'])
    disable_connection(user['id'])
    # Local access is disabled regardless of whether Google's revocation endpoint is reachable.
    try:
        provider_request('POST', 'https://oauth2.googleapis.com/revoke', data={'token': tokens.get('refresh_token') or tokens.get('access_token')})
    except HTTPException:
        pass
    return {'ok': True}


def download(user_id, item):
    route = 'files/' + quote(item['id'], safe='')
    params = {'alt': 'media'}
    if item['exportMime']:
        route += '/export'; params = {'mimeType': item['exportMime']}
    limit = (10 if item['fileType'] in ('Audio', 'Video') or item['exportMime'] else 15) * 1024 * 1024
    try:
        with httpx.stream('GET', API + route, params=params, headers={'Authorization': 'Bearer ' + access_token(user_id)}, timeout=60, follow_redirects=False) as response:
            if response.status_code != 200:
                raise ValueError('Download/export failed. Check file permissions and Google export limits, then sync again.')
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > limit:
                    raise ValueError('The downloaded/exported file exceeds its size limit.')
    except httpx.RequestError:
        raise ValueError('Google Drive download was interrupted. Sync again to retry.') from None
    if not content:
        raise ValueError('The Drive file is empty.')
    return bytes(content)


def run_sync(job):
    from backend.worker import enqueue, report
    with connect() as db:
        link = db.execute('SELECT * FROM drive_links WHERE project_id=?', (job['project_id'],)).fetchone()
    if not link:
        raise ValueError('This Drive import was removed.')
    user_id, project_id = link['user_id'], link['project_id']
    config = ImportConfig.model_validate_json(link['config'])
    counts = {'imported': 0, 'updated': 0, 'unchanged': 0, 'skipped': 0, 'failed': 0, 'removed': 0}
    failures = []
    try:
        report(job['id'], 'Drive inventory', 5, 'Listing selected folders and their supported files.')
        items, paths = inventory(user_id, config)
        eligible_ids = {item['id'] for item in items if not item['skipReason']}
        with connect() as db:
            # Only a complete enumeration can establish that items left the selected tree.
            for old in db.execute('SELECT * FROM drive_items WHERE project_id=?', (project_id,)).fetchall():
                if old['file_id'] not in eligible_ids:
                    counts['removed'] += db.execute('UPDATE sources SET deleted=1 WHERE id=? AND deleted=0', (old['source_id'],)).rowcount
        for i, item in enumerate(items):
            connection(user_id)  # Disconnect stops the run before another download.
            if item['skipReason']:
                counts['skipped'] += 1; continue
            report(job['id'], 'Drive download', 10 + int(70 * i / max(1, len(items))), f"Checking {item['name']}.")
            fingerprint = json.dumps([item.get('version'), item.get('modifiedTime'), item.get('md5Checksum'), item.get('name'), item['folderPath']], sort_keys=True)
            with connect() as db:
                old = db.execute('SELECT i.*,s.data,s.deleted,s.path FROM drive_items i JOIN sources s ON s.id=i.source_id WHERE i.project_id=? AND i.file_id=?', (project_id, item['id'])).fetchone()
            if old and old['fingerprint'] == fingerprint and not old['deleted'] and json.loads(old['data']).get('status') != 'attention':
                counts['unchanged'] += 1; continue
            try:
                content = download(user_id, item)
                source_id = old['source_id'] if old else uuid4().hex
                directory = data_dir() / 'uploads' / user_id / project_id / item['folderPath']
                root = (data_dir() / 'uploads' / user_id / project_id).resolve()
                directory = directory.resolve()
                if not directory.is_relative_to(root):
                    raise ValueError('Invalid import destination.')
                directory.mkdir(parents=True, exist_ok=True)
                path = directory / (source_id + item['extension'])
                path.write_bytes(content)
                old_source = json.loads(old['data']) if old else {}
                source = {**old_source, 'id': source_id, 'title': item['name'], 'fileName': item['name'], 'fileType': item['fileType'],
                    'folderPath': item['folderPath'], 'size': len(content), 'hash': hashlib.sha256(content).hexdigest(),
                    'status': 'reading', 'chunks': [], 'visibility': 'internal', 'origin': 'upload', 'serverManaged': True,
                    'addedAt': old_source.get('addedAt') or datetime.now(timezone.utc).isoformat(),
                    'driveFileId': item['id'], 'sourceUrl': 'https://drive.google.com/file/d/' + quote(item['id'], safe='') + '/view',
                    'transcriptionConsent': config.mediaConsent, 'driveRevision': str(item.get('version', item.get('modifiedTime', '')))}
                source.pop('attention', None)
                with connect() as db:
                    db.execute('BEGIN IMMEDIATE')
                    if not db.execute('SELECT 1 FROM drive_connections WHERE user_id=? AND active=1', (user_id,)).fetchone():
                        raise ValueError('Drive was disconnected. Reconnect before importing.')
                    current_link = db.execute('SELECT config FROM drive_links WHERE project_id=?', (project_id,)).fetchone()
                    if not current_link or item['id'] in json.loads(current_link['config']).get('excludedIds', []):
                        counts['skipped'] += 1
                        continue
                    db.execute('INSERT INTO sources(id,project_id,path,data) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET path=excluded.path,data=excluded.data,deleted=0', (source_id, project_id, str(path), json.dumps(source)))
                    db.execute('INSERT INTO drive_items VALUES (?,?,?,?) ON CONFLICT(project_id,file_id) DO UPDATE SET fingerprint=excluded.fingerprint', (project_id, item['id'], source_id, fingerprint))
                    enqueue(db, project_id, 'ingest', source_id)
                counts['updated' if old else 'imported'] += 1
            except (ValueError, HTTPException) as error:
                counts['failed'] += 1
                failures.append({'name': item['name'], 'error': error.detail if isinstance(error, HTTPException) else str(error)})
                if old:
                    with connect() as db:
                        source = json.loads(old['data']); source.update(status='attention', chunks=[], attention='Drive update failed. Sync again to retry.')
                        db.execute('UPDATE sources SET data=? WHERE id=?', (json.dumps(source), old['source_id']))
        with connect() as db:
            summary = {**counts, 'failures': failures[:30], 'types': dict(Counter(item['fileType'] for item in items)), 'folders': len(paths)}
            db.execute('UPDATE drive_links SET last_sync=?,error=NULL,summary=? WHERE project_id=?', (int(time.time()), json.dumps(summary), project_id))
            if counts['imported'] or counts['updated'] or counts['removed']:
                enqueue(db, project_id, 'index')
        report(job['id'], 'Drive sync', 100, f"Imported {counts['imported']}, updated {counts['updated']}, unchanged {counts['unchanged']}, skipped {counts['skipped']}, failed {counts['failed']}.")
    except Exception as error:
        message = error.detail if isinstance(error, HTTPException) else 'Drive sync was interrupted. Reconnect if needed and sync again.'
        with connect() as db:
            db.execute('UPDATE drive_links SET last_sync=?,error=? WHERE project_id=?', (int(time.time()), message, project_id))
        raise ValueError(message) from None


def schedule_syncs():
    with connect() as db:
        for row in db.execute('SELECT l.* FROM drive_links l JOIN drive_connections c ON c.user_id=l.user_id AND c.active=1 WHERE l.last_sync<?', (int(time.time()) - 900,)).fetchall():
            if json.loads(row['config']).get('autoSync'):
                enqueue_sync(db, row['project_id'])


def validate_passage_access(project, user_id, passages):
    sources = {s['id']: s for s in project['draft'].get('sources', [])}
    with connect() as db:
        saved = db.execute('SELECT config FROM drive_links WHERE project_id=? AND user_id=?', (project['id'], user_id)).fetchone()
    config = ImportConfig.model_validate_json(saved['config']) if saved else None
    memo = {}

    def checked(file_id):
        if file_id not in memo:
            memo[file_id] = metadata(user_id, file_id)
        return memo[file_id]

    def inside_selection(file):
        if not config:
            return False
        queue, visited = [(parent, 0) for parent in file.get('parents', [])], set()
        while queue:
            file_id, depth = queue.pop(0)
            if file_id in visited or file_id in config.excludedIds or depth > 10:
                continue
            visited.add(file_id)
            parent = checked(file_id)
            if parent.get('trashed'):
                continue
            if file_id in config.folderIds:
                return depth == 0 or config.recursive
            queue.extend((parent_id, depth + 1) for parent_id in parent.get('parents', []))
        return False
    for source_id in {p['sourceId'] for p in passages}:
        source = sources.get(source_id, {})
        if not source.get('driveFileId'):
            continue
        try:
            current = checked(source['driveFileId'])
            if current.get('trashed') or current.get('capabilities', {}).get('canDownload') is False:
                raise HTTPException(403, 'Drive access changed.')
            if not inside_selection(current) or current['id'] in config.excludedIds:
                raise HTTPException(403, 'The file is outside the selected folders.')
            if str(current.get('version', current.get('modifiedTime', ''))) != source.get('driveRevision'):
                raise HTTPException(409, 'A referenced Drive document changed. Sync Drive before asking again.')
        except HTTPException as error:
            if error.status_code in (403, 404):
                with connect() as db:
                    db.execute('UPDATE sources SET deleted=1 WHERE id=? AND project_id=?', (source_id, project['id']))
                raise HTTPException(409, 'A referenced Drive document is no longer accessible. Sync Drive to update your knowledge.') from None
            raise
