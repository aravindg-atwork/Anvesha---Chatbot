import type { IndexedChunk } from './knowledge';
import { tokenize, uniqueTerms } from '../lib/text';

/**
 * Lexical retrieval (BM25). It ranks passages by shared words with the question.
 * It does not understand meaning, and a high score does not prove an answer is correct.
 */
export interface Hit {
  chunk: IndexedChunk;
  score: number;
  /** Share of the question's key words that appear in the passage (0–1). */
  coverage: number;
  matched: string[];
}

const K1 = 1.4;
const B = 0.75;

export function search(index: IndexedChunk[], query: string, limit = 6): Hit[] {
  const qTerms = uniqueTerms(query);
  if (!qTerms.length || !index.length) return [];
  const docs = index.map((c) => {
    // Headings and FAQ questions are part of what a passage is "about", so they count towards matching.
    const extra = c.locator.kind === 'section' ? c.locator.heading : c.locator.kind === 'faq' ? c.locator.question : '';
    const toks = tokenize(`${extra} ${c.text}`);
    const tf = new Map<string, number>();
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return { c, tf, len: toks.length };
  });
  const avg = docs.reduce((s, d) => s + d.len, 0) / docs.length || 1;
  const df = new Map<string, number>();
  for (const t of qTerms) df.set(t, docs.filter((d) => d.tf.has(t)).length);

  const hits: Hit[] = [];
  for (const d of docs) {
    let score = 0;
    const matched: string[] = [];
    for (const t of qTerms) {
      const f = d.tf.get(t);
      if (!f) continue;
      matched.push(t);
      const n = df.get(t) ?? 0;
      const idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / avg)));
    }
    if (score > 0) hits.push({ chunk: d.c, score, coverage: matched.length / qTerms.length, matched });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Finds the sentence(s) in a passage that best match the question. Returns an exact substring. */
export function bestExcerpt(text: string, query: string, maxSentences = 3): string {
  const q = new Set(uniqueTerms(query));
  // A single line break (common in PDF text) does not end a sentence; a blank line does.
  // A full stop inside a number ("1.5 days") does not end a sentence either.
  const sentences = Array.from(text.matchAll(/(?:[^.!?\n]|\.(?=\d)|\n(?![ \t]*\n))+(?:[.!?]+["')\]]*)?/g))
    .map((m) => ({ s: m[0].trim(), i: m.index ?? 0 }))
    .filter((x) => x.s.length > 3);
  if (!sentences.length) return text.trim();
  const scored = sentences.map((x, idx) => ({ ...x, idx, score: uniqueTerms(x.s).filter((t) => q.has(t)).length }));
  const best = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx)[0];
  if (best.score === 0) return sentences[0].s;
  // Continue through the same paragraph so qualifications ("however…", "submission does not
  // guarantee…") are not cut off from the sentence they qualify.
  const picked = [best];
  for (let k = best.idx + 1; k < scored.length && picked.length < maxSentences; k++) {
    const prev = picked[picked.length - 1];
    const between = text.slice(prev.i + prev.s.length, scored[k].i);
    if (/\n\s*\n/.test(between)) break;
    if (picked.reduce((n, x) => n + x.s.length, 0) + scored[k].s.length > 420) break;
    picked.push(scored[k]);
  }
  const start = picked[0].i + (text.slice(picked[0].i).length - text.slice(picked[0].i).trimStart().length);
  const last = picked[picked.length - 1];
  const end = text.indexOf(last.s, last.i) + last.s.length;
  return text.slice(start, end);
}
