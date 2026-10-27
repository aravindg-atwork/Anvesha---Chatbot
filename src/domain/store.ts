import { useSyncExternalStore } from 'react';
import type { AppState } from './types';
import { SCHEMA_VERSION, emptyState, recoverInterrupted } from './operations';

const KEY = 'anvesha:state';

type Listener = () => void;
const listeners = new Set<Listener>();
let state: AppState = emptyState();
let lastSaveError: string | null = null;
let loadNotice: string | null = null;

/**
 * Loads saved data. Data is never silently discarded: anything unreadable, or saved by a newer
 * version, is copied to a backup key before starting fresh.
 */
function migrate(raw: unknown): AppState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<AppState>;
  if (r.schemaVersion === SCHEMA_VERSION) return { ...emptyState(), ...r } as AppState;
  // Future schema changes add upgrade steps here, e.g. if (r.schemaVersion === 1) { ...; r.schemaVersion = 2 }
  return null;
}

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
    if (m) return recoverInterrupted(m);
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
      if (m) {
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
  save();
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
  setState(emptyState());
}
