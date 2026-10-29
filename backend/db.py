"""Durable local database. Every connection enforces foreign keys and transactions."""
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


def data_dir():
    path = Path(os.getenv('ANVESHA_DATA_DIR', str(Path(__file__).resolve().parents[1] / 'data')))
    path.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connect():
    db = sqlite3.connect(data_dir() / 'anvesha.sqlite3', timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


def init_db():
    with connect() as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
          password TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS sessions (
          token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS accounts (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          revision INTEGER NOT NULL DEFAULT 0, preferences TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          data TEXT NOT NULL, index_revision TEXT);
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          path TEXT NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          source_id TEXT REFERENCES sources(id) ON DELETE CASCADE, kind TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued', stage TEXT NOT NULL DEFAULT 'Queued',
          progress INTEGER NOT NULL DEFAULT 0, error TEXT, events TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, data TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS jobs_project ON jobs(project_id, created_at);
        CREATE INDEX IF NOT EXISTS sources_project ON sources(project_id);
        CREATE TABLE IF NOT EXISTS drive_connections (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          credentials TEXT NOT NULL, email TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS drive_oauth_states (
          state TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          session_hash TEXT NOT NULL, project_id TEXT NOT NULL, verifier TEXT NOT NULL, expires INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS drive_links (
          project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          config TEXT NOT NULL, last_sync INTEGER NOT NULL DEFAULT 0, error TEXT, summary TEXT NOT NULL DEFAULT '{}');
        CREATE TABLE IF NOT EXISTS drive_items (
          project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, file_id TEXT NOT NULL,
          source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE, fingerprint TEXT NOT NULL,
          PRIMARY KEY(project_id,file_id));
        ''')


def source_list(db, project):
    draft = project['draft']
    uploaded = {r['id']: json.loads(r['data']) for r in db.execute(
        'SELECT id,data FROM sources WHERE project_id=? AND deleted=0', (project['id'],))}
    result = []
    for source in draft.get('sources', []):
        if source['id'] in uploaded:
            authoritative = uploaded.pop(source['id'])
            # Owner metadata is editable; extracted text and job status are server-owned.
            for key in ('title', 'visibility', 'version', 'effectiveDate', 'reviewBy', 'supersedes', 'tags'):
                if key in source:
                    authoritative[key] = source[key]
            if authoritative.get('driveFileId'):
                authoritative['visibility'] = 'internal'
            result.append(authoritative)
        elif source.get('origin') != 'upload':
            result.append(source)
    return result + list(uploaded.values())


def project_data(db, row):
    project = json.loads(row['data'])
    project['draft']['sources'] = source_list(db, project)
    return project
