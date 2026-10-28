import type { Source } from '../../../domain/types';
import { dispatch, getState, flushRemote, isRemoteSession } from '../../../domain/store';
import { api } from '../../../lib/api';
import { toast } from '../../components/ui';
import * as op from '../../../domain/operations';
import { extractFile, fileTypeOf, precheckFile, titleFromFileName } from '../../../domain/ingest';
import { uid, nowIso } from '../../../lib/id';

// File objects live only in memory (they are too large for browser storage).
// They let "Try again" work in this session; after a reload, the owner chooses the file again.
const files = new Map<string, File>();

export const canRetry = (sourceId: string) => files.has(sourceId) || getState().assistants.some((a) => a.draft.sources.some((s) => s.id === sourceId && s.serverManaged));

function assistantSources(assistantId: string): Source[] {
  return getState().assistants.find((a) => a.id === assistantId)?.draft.sources ?? [];
}

async function processInto(assistantId: string, sourceId: string, file: File) {
  const patch = (p: Partial<Source>) => dispatch((s) => op.updateSource(s, assistantId, sourceId, p));
  try {
    const check = await precheckFile(file, assistantSources(assistantId), sourceId);
    if (!check.ok) {
      // Retrying the same file cannot help with format, size, empty or duplicate problems.
      files.delete(sourceId);
      return patch({ status: 'attention', attention: check.reason, chunks: [] });
    }
    // Keep the "Reading file" state visible briefly so the change is noticeable.
    const [ex] = await Promise.all([extractFile(check.type, check.data, sourceId), new Promise((r) => setTimeout(r, 600))]);
    patch({
      hash: check.hash,
      size: file.size,
      chunks: ex.chunks,
      extractionNote: ex.note,
      status: ex.chunks.length ? 'ready' : 'attention',
      attention: ex.attention,
    });
  } catch (e) {
    console.error(e);
    patch({
      status: 'attention',
      chunks: [],
      attention: 'This file could not be read. It may be damaged or password-protected. Try again, or replace it with another copy.',
    });
  }
}

/** Adds a document and reads it. CSV files are handled separately as question-and-answer imports. */
export async function addFile(assistantId: string, file: File) {
  if (isRemoteSession()) {
    try {
      await flushRemote();
      const form = new FormData();
      form.append('file', file);
      const result = await api<{ source: Source }>(`/api/projects/${assistantId}/sources`, { method: 'POST', body: form });
      dispatch((s) => op.addSource(s, assistantId, result.source));
    } catch (e) { toast(e instanceof Error ? e.message : 'Upload failed. Please retry.'); }
    return;
  }
  const type = fileTypeOf(file.name);
  const id = uid('src');
  files.set(id, file);
  const source: Source = {
    id,
    title: titleFromFileName(file.name),
    fileName: file.name,
    fileType: type ?? 'Other',
    size: file.size,
    status: 'reading',
    chunks: [],
    visibility: 'internal',
    origin: 'upload',
    addedAt: nowIso(),
  };
  dispatch((s) => op.addSource(s, assistantId, source));
  await processInto(assistantId, id, file);
}

export async function retry(assistantId: string, sourceId: string) {
  if (isRemoteSession()) {
    try {
      await api(`/api/projects/${assistantId}/sources/${sourceId}/retry`, { method: 'POST' });
      dispatch((s) => op.updateSource(s, assistantId, sourceId, { status: 'reading', attention: undefined }));
      return true;
    } catch (e) { toast(e instanceof Error ? e.message : 'Retry failed.'); return false; }
  }
  const f = files.get(sourceId);
  if (!f) return false;
  dispatch((s) => op.updateSource(s, assistantId, sourceId, { status: 'reading', attention: undefined }));
  await processInto(assistantId, sourceId, f);
  return true;
}

export async function replace(assistantId: string, sourceId: string, file: File) {
  if (isRemoteSession()) {
    // Upload first, so a rejected replacement never removes the original.
    await flushRemote();
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api<{ source: Source }>(`/api/projects/${assistantId}/sources`, { method: 'POST', body: form });
      await removeFile(assistantId, sourceId);
      dispatch((s) => op.addSource(s, assistantId, result.source));
    } catch (e) { toast(e instanceof Error ? e.message : 'Replacement failed.'); }
    return;
  }
  files.set(sourceId, file);
  const type = fileTypeOf(file.name);
  dispatch((s) =>
    op.updateSource(s, assistantId, sourceId, {
      status: 'reading',
      attention: undefined,
      fileName: file.name,
      fileType: type ?? 'Other',
      size: file.size,
      addedAt: nowIso(),
    }),
  );
  await processInto(assistantId, sourceId, file);
}

export function forget(sourceId: string) {
  files.delete(sourceId);
}

export async function removeFile(assistantId: string, sourceId: string) {
  if (isRemoteSession()) await api(`/api/projects/${assistantId}/sources/${sourceId}`, { method: 'DELETE' });
  forget(sourceId);
  dispatch((s) => op.removeSource(s, assistantId, sourceId));
}
