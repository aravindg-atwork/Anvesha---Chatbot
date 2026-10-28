import { useEffect, useState } from 'react';
import { fetchModelStatus } from '../../domain/engine';

type Status = { modelAvailable: boolean; model: string | null; checked: boolean; connectionState?: string; modelError?: string | null };
let cached: Status = { modelAvailable: false, model: null, checked: false };
let inflight: Promise<void> | null = null;
const subs = new Set<(s: Status) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

export function refreshModelStatus(): Promise<void> {
  if (inflight) return inflight;
  inflight = fetchModelStatus().then((r) => {
    cached = { ...r, checked: true };
    subs.forEach((f) => f(cached));
  }).finally(() => { inflight = null; });
  return inflight;
}
const onFocus = () => { void refreshModelStatus(); };

/** Asks the local server whether a model key is configured. Never exposes the key itself. */
export function useModelStatus(): Status {
  const [s, set] = useState(cached);
  useEffect(() => {
    subs.add(set);
    if (!cached.checked) void refreshModelStatus();
    if (subs.size === 1) {
      timer = setInterval(() => void refreshModelStatus(), 30_000);
      window.addEventListener('focus', onFocus);
    }
    return () => {
      subs.delete(set);
      if (subs.size === 0) {
        clearInterval(timer);
        window.removeEventListener('focus', onFocus);
      }
    };
  }, []);
  return s;
}
