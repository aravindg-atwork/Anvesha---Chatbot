import { useSyncExternalStore } from 'react';
import type { AppState, StepId } from './types';
import { SCHEMA_VERSION, emptyState, knowledgeSignature, recoverInterrupted } from './operations';
import { api, ApiError } from '../lib/api';
import type { Source } from './types';

const KEY = 'anvesha:state';

type Listener = () => void;
const listeners = new Set<Listener>();
let state: AppState = emptyState();
let lastSaveError: string | null = null;
let loadNotice: string | null = null;
let remote = false;
let revision = 0;
let dirty = false;
let saving: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const V1_STEP: Record<string, StepId> = { describe: 'upload', knowledge: 'upload', review: 'review', try: 'try', share: 'publish' };

/** Upgrades saved data one version at a time. Nothing is dropped. */
export function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = structuredClone(raw) as AppState & { schemaVersion: number };
  if (r.schemaVersion === 1) {
    // v2: new six-step project flow and customisation fields.
    for (const a of r.assistants ?? []) {
      a.currentStep = V1_STEP[a.currentStep as string] ?? 'upload';
      a.completedSteps = Array.from(new Set((a.completedSteps as string[]).map((x) => V1_STEP[x]).filter(Boolean)));
      if (a.completedSteps.includes('try')) a.completedSteps.push('training');
      a.trainedSignature = a.completedSteps.includes('training') ? knowledgeSignature(a.draft) : null;
      a.draft.tone ??= 'friendly';
      a.draft.avatar ??= '';
      a.draft.starterQuestions ??= null;
    }
    r.schemaVersion = 2;
  }
  if (r.schemaVersion === SCHEMA_VERSION) return { ...emptyState(), ...r };
  return null;
}

/**
 * Loads saved data. Data is never silently discarded: anything unreadable, or saved by a newer
 * version, is copied to a backup key before starting fresh.
 */
function load(): AppState {
  let text: string | null = null;
  try {
    text = localStorage.getItem(KEY);
  } catch {
    loadNotice = 'This browser is blocking saved data, so changes will last only until you close the page.';
    return emptyState();
  }
  if (!text) return emptyState();
  try {
    const m = migrate(JSON.parse(text));
    if (m) return m.session?.kind === 'demo' ? recoverInterrupted(m) : emptyState();
  } catch {
    /* fall through to backup */
  }
  const backupKey = `${KEY}:backup:${Date.now()}`;
  try {
    localStorage.setItem(backupKey, text);
  } catch {
    /* ignore */
  }
  loadNotice = `Saved data could not be read by this version, so it was kept safely under “${backupKey}” and a fresh start was made.`;
  return emptyState();
}

function save() {
  if (remote && state.session?.kind === 'local') {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { void flushRemote().catch(() => {}); }, 350);
    return;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    lastSaveError = null;
  } catch {
    lastSaveError = 'Your latest change could not be saved because browser storage is full. Remove large files or reset the demo.';
  }
}

if (typeof window !== 'undefined') {
  state = load();
  // Keep multiple tabs (e.g. the owner view and an end-user preview) in step.
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const m = migrate(JSON.parse(e.newValue));
      if (m && !remote && m.session?.kind === 'demo') {
        state = m;
        listeners.forEach((l) => l());
      }
    } catch {
      /* ignore */
    }
  });
}

export function getState(): AppState {
  return state;
}

export function setState(next: AppState) {
  if (next === state) return;
  state = next;
  if (next.session?.kind === 'demo') remote = false;
  save();
  listeners.forEach((l) => l());
}

export const isRemoteSession = () => remote && state.session?.kind === 'local';

export async function loadRemoteState() {
  const result = await api<{ state: AppState; revision: number }>('/api/state');
  const next = migrate(result.state);
  if (!next) throw new Error('The server returned an unsupported workspace version.');
  remote = true;
  revision = result.revision;
  dirty = false;
  state = next;
  lastSaveError = null;
  listeners.forEach((l) => l());
}

export async function initializeSession() {
  if (window.location.hash.startsWith('#/demo')) return;
  try { await loadRemoteState(); } catch (e) {
    if (!(e instanceof ApiError && e.status === 401) && state.session?.kind !== 'demo') state = emptyState();
  }
}

export async function flushRemote(): Promise<void> {
  clearTimeout(saveTimer);
  if (saving) {
    await saving;
    if (dirty) return flushRemote();
    return;
  }
  if (!remote || !dirty) return;
  const run = async () => {
    while (dirty && remote) {
      dirty = false;
      try {
        // Server-owned extracted passages are already in the DB; avoid uploading them on every edit.
        const snapshot = { ...state, assistants: state.assistants.map((a) => ({ ...a, draft: { ...a.draft,
          sources: a.draft.sources.map((s) => s.serverManaged ? { ...s, chunks: [] } : s),
        } })) };
        const result = await api<{ revision: number }>('/api/state', { method: 'PUT', body: JSON.stringify({ state: snapshot, revision }) });
        revision = result.revision;
        lastSaveError = null;
      } catch (e) {
        dirty = true;
        lastSaveError = e instanceof Error ? e.message : 'Changes could not be saved to the server.';
        listeners.forEach((l) => l());
        throw e;
      }
    }
  };
  saving = run();
  try { await saving; } finally { saving = null; }
}

export function applyServerSources(assistantId: string, sources: Source[]) {
  state = { ...state, assistants: state.assistants.map((a) => {
    if (a.id !== assistantId) return a;
    const incoming = new Map(sources.filter((s) => s.serverManaged).map((s) => [s.id, s]));
    const merged = a.draft.sources.filter((s) => !s.serverManaged || incoming.has(s.id)).map((s) => {
      const fresh = incoming.get(s.id);
      if (!fresh) return s;
      incoming.delete(s.id);
      return { ...s, status: fresh.status, attention: fresh.attention, chunks: fresh.chunks, extractionNote: fresh.extractionNote };
    });
    return { ...a, draft: { ...a.draft, sources: [...merged, ...incoming.values()] } };
  }) };
  listeners.forEach((l) => l());
}

export async function signOut() {
  if (remote) {
    await flushRemote();
    await api('/api/auth/signout', { method: 'POST' });
  }
  remote = false;
  dirty = false;
  state = emptyState();
  listeners.forEach((l) => l());
}

/** Apply a pure operation from operations.ts. */
export function dispatch(op: (s: AppState) => AppState) {
  setState(op(state));
}

/** Apply an operation that also returns a value (e.g. a new id). */
export function dispatchWith<T>(op: (s: AppState) => { state: AppState } & T): Omit<T, 'state'> {
  const r = op(state);
  setState(r.state);
  return r;
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppState<T>(select: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export const storageNotices = {
  saveError: () => lastSaveError,
  loadNotice: () => loadNotice,
  clearLoadNotice: () => {
    loadNotice = null;
  },
};

export function resetEverything() {
  setState(remote ? { ...emptyState(), session: state.session, modelPreference: state.modelPreference } : emptyState());
}
