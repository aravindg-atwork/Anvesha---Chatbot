"""Poll registered server-side document copies; never scan arbitrary host directories."""
import hashlib
import json
from pathlib import Path
from backend.db import connect, data_dir
from backend.catalog import describe_source


def scan_sources():
    from backend.worker import enqueue, enqueue_index_when_settled
    root = (data_dir() / 'uploads').resolve()
    with connect() as db:
        rows = db.execute('SELECT * FROM sources WHERE deleted=0').fetchall()
    for row in rows:
        source = json.loads(row['data'])
        if source.get('status') == 'ready' and not source.get('catalogMethod'):
            source.update(describe_source(source))
            with connect() as db:
                # Metadata backfill is content-based and needs no provider call or reindex.
                latest = db.execute('SELECT data FROM sources WHERE id=? AND deleted=0', (row['id'],)).fetchone()
                if latest:
                    current = json.loads(latest['data'])
                    if current.get('status') == 'ready':
                        current.update({key: source[key] for key in ('documentLabel', 'autoTags', 'suggestedQuestions', 'catalogMethod', 'cataloguedAt')})
                        db.execute('UPDATE sources SET data=? WHERE id=?', (json.dumps(current), row['id']))
        if source.get('driveFileId') or source.get('fileType') in ('Audio', 'Video') or source.get('status') == 'reading':
            continue
        path = Path(row['path']).resolve()
        if not path.is_relative_to(root):
            continue
        try:
            stat = path.stat()
            stamp = f'{stat.st_mtime_ns}:{stat.st_size}'
            if source.get('diskStamp') == stamp:
                continue
            if stat.st_size > 15 * 1024 * 1024:
                digest = None
                reason = 'The updated server copy exceeds 15 MB. Replace it with a smaller document.'
            else:
                digest = hashlib.sha256(path.read_bytes()).hexdigest()
                reason = None
        except OSError:
            stamp, digest, reason = 'missing', None, 'The stored original is missing or unreadable. Replace this source in Upload.'
            if source.get('diskStamp') == stamp:
                continue
        with connect() as db:
            db.execute('BEGIN IMMEDIATE')
            latest = db.execute('SELECT data FROM sources WHERE id=? AND deleted=0', (row['id'],)).fetchone()
            if not latest:
                continue
            current = json.loads(latest['data'])
            if current.get('status') == 'reading' or current.get('diskStamp') == stamp:
                continue
            current['diskStamp'] = stamp
            if reason:
                current.update(status='attention', chunks=[], attention=reason)
            elif digest != current.get('hash'):
                current.update(status='reading', chunks=[], hash=digest, size=stat.st_size, suggestedQuestions=[], autoTags=[])
                current.pop('attention', None)
                enqueue(db, row['project_id'], 'ingest', row['id'])
            db.execute('UPDATE sources SET data=? WHERE id=?', (json.dumps(current), row['id']))
            if reason:
                enqueue_index_when_settled(db, row['project_id'])
