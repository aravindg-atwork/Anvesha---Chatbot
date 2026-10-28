import hashlib
import json
import os
import threading
from functools import lru_cache
from uuid import UUID

from fastembed import TextEmbedding
from qdrant_client import QdrantClient, models

COLLECTION = 'anvesha_passages_v1'
EMBED_MODEL = 'BAAI/bge-small-en-v1.5'
embedding_lock = threading.Lock()


@lru_cache(maxsize=1)
def client():
    return QdrantClient(url=os.getenv('QDRANT_URL', 'http://127.0.0.1:6333'), timeout=30)


@lru_cache(maxsize=1)
def embedder():
    return TextEmbedding(model_name=EMBED_MODEL, cache_dir=os.getenv('FASTEMBED_CACHE_PATH'), threads=2)


def embed(texts, query=False):
    with embedding_lock:
        model = embedder()
        return [v.tolist() for v in (model.query_embed(texts) if query else model.passage_embed(texts))]


def ensure_collection():
    q = client()
    if not q.collection_exists(COLLECTION):
        q.create_collection(COLLECTION, vectors_config=models.VectorParams(size=384, distance=models.Distance.COSINE))
        for field in ('user_id', 'project_id', 'revision'):
            q.create_payload_index(COLLECTION, field_name=field, field_schema=models.PayloadSchemaType.KEYWORD)


def eligible(project):
    draft = project['draft']
    sources = draft.get('sources', [])
    superseded = {s['supersedes'] for s in sources if s.get('supersedes')}
    excluded = set()
    for conflict in draft.get('conflicts', []):
        resolution = conflict.get('resolution')
        if resolution and resolution.get('kind') == 'prefer':
            loser = conflict['b'] if resolution['sourceId'] == conflict['a']['sourceId'] else conflict['a']
            excluded.add(loser['chunkId'])
    result = []
    for source in sources:
        if source.get('status') != 'ready' or source['id'] in superseded:
            continue
        for chunk in source.get('chunks', []):
            if chunk['id'] not in excluded:
                result.append({**chunk, 'sourceTitle': source['title'], 'fileType': source['fileType'], 'visibility': source['visibility']})
    for faq in draft.get('faqs', []):
        if faq.get('approved'):
            result.append({'id': f"faq:{faq['id']}", 'sourceId': 'faq', 'sourceTitle': 'Questions and answers',
                           'fileType': 'Written', 'text': faq['question'] + '\n' + faq['answer'],
                           'visibility': faq['visibility'], 'locator': {'kind': 'faq', 'entryId': faq['id'], 'code': faq['code'], 'question': faq['question']}})
    return result


def signature(project):
    return hashlib.sha256(json.dumps(eligible(project), sort_keys=True).encode()).hexdigest()


def index_project(project, user_id, report):
    chunks = eligible(project)
    if not chunks:
        raise ValueError('No readable passages are ready. Fix failed files or add information first.')
    if any(s.get('status') == 'reading' for s in project['draft'].get('sources', [])):
        raise ValueError('Some files are still processing. Wait for them to finish and train again.')
    ensure_collection()
    revision = signature(project)
    for start in range(0, len(chunks), 32):
        batch = chunks[start:start+32]
        report('Indexing agent', 10 + int(85 * start / len(chunks)),
               f'Embedding passages {start+1}–{min(start+32, len(chunks))} of {len(chunks)}. First run may download the local embedding model.')
        vectors = embed([c['text'] for c in batch])
        points = []
        for chunk, vector in zip(batch, vectors):
            uid = str(UUID(hashlib.md5(f"{user_id}:{project['id']}:{revision}:{chunk['id']}".encode()).hexdigest()))
            points.append(models.PointStruct(id=uid, vector=vector, payload={**chunk, 'user_id': user_id, 'project_id': project['id'], 'revision': revision}))
        client().upsert(COLLECTION, points=points, wait=True)
    return revision, len(chunks)


def search_project(project_id, user_id, revision, question):
    vector = embed([question], query=True)[0]
    filters = models.Filter(must=[models.FieldCondition(key=k, match=models.MatchValue(value=v))
                                 for k, v in {'user_id': user_id, 'project_id': project_id, 'revision': revision}.items()])
    points = client().query_points(COLLECTION, query=vector, query_filter=filters, limit=6, score_threshold=0.35).points
    return [p.payload for p in points if p.payload]
