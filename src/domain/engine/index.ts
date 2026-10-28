import type { AnswerPayload } from '../types';
import { buildIndex, formatLocator, type KnowledgeView } from '../knowledge';
import { bestExcerpt, search } from '../retrieval';
import { answerExtractive } from './extractive';
import { EVIDENCE_TEXT, evidenceFromCoverage, makeCitation, noInformation } from './common';

/** The chat interface depends only on this contract, never on a specific provider. */
export interface AnswerEngine {
  id: 'demo' | 'model';
  answer(view: KnowledgeView, question: string): Promise<AnswerPayload>;
}

export class EngineError extends Error {}

export const demoEngine: AnswerEngine = {
  id: 'demo',
  async answer(view, question) {
    // Small, consistent delay so the "thinking" state is visible without being slow.
    await new Promise((r) => setTimeout(r, 450));
    return answerExtractive(view, question);
  },
};

/** Calls the server-side boundary (server/chatApi.ts). The browser never holds a key. */
export const modelEngine: AnswerEngine = {
  id: 'model',
  async answer(view, question) {
    const index = buildIndex(view);
    const hits = search(index, question, 5);
    const top = hits[0];
    if (!top || evidenceFromCoverage(top.coverage, top.matched.length) === 'none') return noInformation(question);

    const passages = hits.map((h) => ({ id: h.chunk.id, label: `${h.chunk.source.title} — ${formatLocator(h.chunk.locator)}`, text: h.chunk.text }));
    let res: Response;
    try {
      res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question, instructions: view.instructions, passages }),
      });
    } catch {
      throw new EngineError('The answer service could not be reached.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new EngineError(body.error || `The answer service returned an error (${res.status}).`);
    }
    const { text } = (await res.json()) as { text: string };

    // Map [S#] markers onto citations, keeping only passages the model actually cited.
    const citedIdx = Array.from(new Set(Array.from(text.matchAll(/\[S(\d+)\]/g)).map((m) => Number(m[1]) - 1))).filter(
      (i) => i >= 0 && i < hits.length,
    );
    const numberOf = new Map(citedIdx.map((i, n) => [i, n + 1]));
    const out = text
      .replace(/\[S(\d+)\]/g, (_, d) => {
        const n = numberOf.get(Number(d) - 1);
        return n ? `[${n}]` : '';
      })
      .replace(/[ \t]+$/gm, '')
      .trim();
    const citations = citedIdx.map((i, n) => makeCitation(n + 1, hits[i].chunk, bestExcerpt(hits[i].chunk.text, question)));
    const evidence = citations.length ? evidenceFromCoverage(top.coverage, top.matched.length) : 'none';
    return {
      kind: citations.length ? 'answer' : 'no-info',
      text: out,
      citations,
      evidence,
      evidenceReason: EVIDENCE_TEXT[evidence].basis,
      method: 'model',
      showHandover: evidence !== 'strong',
    };
  },
};

export async function fetchModelStatus(): Promise<{ modelAvailable: boolean; model: string | null; connectionState?: string; modelError?: string | null }> {
  try {
    const r = await fetch('/api/status');
    if (!r.ok) return { modelAvailable: false, model: null };
    return await r.json();
  } catch {
    return { modelAvailable: false, model: null };
  }
}
