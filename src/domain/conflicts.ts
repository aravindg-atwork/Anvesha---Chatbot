import type { Conflict, Source } from './types';
import { numbersIn, uniqueTerms } from '../lib/text';
import { uid } from '../lib/id';

/**
 * Automatic "number check": flags passages from different sources that discuss the same topic
 * (high word overlap) but state different numbers. It is a heuristic — it can miss real conflicts
 * and flag harmless differences — and is labelled that way in the interface.
 */
export const NUMBER_CHECK_LABEL =
  'Automatic check: compares passages on the same topic that state different numbers. It can miss conflicts or flag harmless differences.';

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  a.forEach((t) => b.has(t) && inter++);
  return inter / (a.size + b.size - inter || 1);
}

export function detectNumberConflicts(sources: Source[], existing: Conflict[]): Conflict[] {
  const ready = sources.filter((s) => s.status === 'ready');
  const related = new Set<string>();
  for (const s of ready) if (s.supersedes) related.add([s.id, s.supersedes].sort().join('|'));
  const known = new Set(existing.map((c) => [c.a.chunkId, c.b.chunkId].sort().join('|')));
  const knownSourcePairs = new Set(existing.map((c) => [c.a.sourceId, c.b.sourceId].sort().join('|') + '|' + c.topic));

  const items = ready
    .flatMap((s) => s.chunks.map((c) => ({ s, c, terms: new Set(uniqueTerms(c.text)), nums: numbersIn(c.text) })))
    .filter((x) => x.nums.length)
    .slice(0, 500);

  const found: Conflict[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const x = items[i];
      const y = items[j];
      if (x.s.id === y.s.id) continue;
      if (related.has([x.s.id, y.s.id].sort().join('|'))) continue;
      const key = [x.c.id, y.c.id].sort().join('|');
      if (known.has(key)) continue;
      if (jaccard(x.terms, y.terms) < 0.45) continue;
      const nx = x.nums.join(',');
      const ny = y.nums.join(',');
      if (nx === ny) continue;
      const topic =
        x.c.locator.kind === 'section' ? x.c.locator.heading.replace(/^\d+(\.\d+)*\.?\s*/, '') : x.c.text.split(/\s+/).slice(0, 6).join(' ') + '…';
      if (knownSourcePairs.has([x.s.id, y.s.id].sort().join('|') + '|' + topic)) continue;
      known.add(key);
      found.push({
        id: uid('cf'),
        topic,
        a: { sourceId: x.s.id, chunkId: x.c.id },
        b: { sourceId: y.s.id, chunkId: y.c.id },
        detectedBy: 'number-check',
        resolution: null,
      });
    }
  }
  return found;
}

/** Remove conflicts whose passages no longer exist (e.g. a source was removed or replaced). */
export function pruneConflicts(conflicts: Conflict[], sources: Source[]): Conflict[] {
  const chunkIds = new Set(sources.flatMap((s) => s.chunks.map((c) => c.id)));
  return conflicts.filter((c) => chunkIds.has(c.a.chunkId) && chunkIds.has(c.b.chunkId));
}
