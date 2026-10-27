import { useEffect, useState } from 'react';
import { fetchModelStatus } from '../../domain/engine';

type Status = { modelAvailable: boolean; model: string | null; checked: boolean };
let cached: Status = { modelAvailable: false, model: null, checked: false };
let inflight: Promise<void> | null = null;
const subs = new Set<(s: Status) => void>();

/** Asks the local server whether a model key is configured. Never exposes the key itself. */
export function useModelStatus(): Status {
  const [s, set] = useState(cached);
  useEffect(() => {
    subs.add(set);
    if (!cached.checked && !inflight) {
      inflight = fetchModelStatus().then((r) => {
        cached = { ...r, checked: true };
        subs.forEach((f) => f(cached));
      });
    }
    return () => {
      subs.delete(set);
    };
  }, []);
  return s;
}
