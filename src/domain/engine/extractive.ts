import type { AnswerPayload, Citation } from '../types';
import { buildIndex, type IndexedChunk, type KnowledgeView } from '../knowledge';
import { bestExcerpt, search, type Hit } from '../retrieval';
import { uniqueTerms } from '../../lib/text';
import { EVIDENCE_TEXT, evidenceFromCoverage, makeCitation, noInformation } from './common';
import { scriptedAnswer } from './scripted';

const OUT_OF_SCOPE = /\b(approve|approval for me|reject|grant me|sanction|guarantee)\b/i;

function locatorName(c: IndexedChunk): string {
  if (c.locator.kind === 'section') return c.locator.heading.replace(/^\d+(\.\d+)*\.?\s*/, '');
  if (c.locator.kind === 'faq') return c.locator.question;
  return c.source.title;
}

/** Unresolved conflicts touching the top results, where both sides are still answerable. */
function conflictFor(view: KnowledgeView, index: IndexedChunk[], hits: Hit[]) {
  const ids = new Set(index.map((c) => c.id));
  const top = new Set(hits.slice(0, 3).map((h) => h.chunk.id));
  return view.conflicts.find(
    (c) => c.resolution?.kind !== 'prefer' && ids.has(c.a.chunkId) && ids.has(c.b.chunkId) && (top.has(c.a.chunkId) || top.has(c.b.chunkId)),
  );
}

/**
 * Deterministic engine. No AI model: answers quote the best-matching passages.
 * Works offline and gives the same result every time for the same knowledge.
 */
export function answerExtractive(view: KnowledgeView, question: string): AnswerPayload {
  const index = buildIndex(view);
  const scripted = scriptedAnswer(view, index, question);
  if (scripted) return scripted;

  const terms = uniqueTerms(question);
  if (!terms.length) {
    return {
      kind: 'clarify',
      text: 'Could you tell me a little more about what you’d like to know?',
      citations: [],
      evidence: 'none',
      evidenceReason: EVIDENCE_TEXT.none.basis,
      method: 'limitation',
      showHandover: false,
    };
  }

  const hits = search(index, question, 6);
  const top = hits[0];
  if (!top || evidenceFromCoverage(top.coverage, top.matched.length) === 'none') {
    const closest = top && top.matched.length >= 2 ? makeCitation(1, top.chunk, bestExcerpt(top.chunk.text, question)) : undefined;
    return noInformation(question, closest);
  }

  const conflict = conflictFor(view, index, hits);
  if (conflict) {
    const a = index.find((c) => c.id === conflict.a.chunkId)!;
    const b = index.find((c) => c.id === conflict.b.chunkId)!;
    return {
      kind: 'conflict',
      text: [
        `Your sources give different information about ${conflict.topic.toLowerCase()}, so I can’t say which applies.`,
        `${a.source.title} says: “${bestExcerpt(a.text, question).replace(/\s+/g, ' ')}” [1]`,
        `${b.source.title} says: “${bestExcerpt(b.text, question).replace(/\s+/g, ' ')}” [2]`,
        'Please check with the right team which version is current.',
      ].join('\n\n'),
      citations: [makeCitation(1, a, bestExcerpt(a.text, question)), makeCitation(2, b, bestExcerpt(b.text, question))],
      evidence: 'partial',
      evidenceReason: 'Two sources cover this question but disagree, so neither fully supports a single answer.',
      method: 'extractive',
      showHandover: true,
    };
  }

  // Short, broad questions that match several different topics: ask which one is meant.
  const distinct = hits.filter((h, i, arr) => arr.findIndex((x) => locatorName(x.chunk) === locatorName(h.chunk)) === i);
  if (terms.length <= 1 && distinct.length >= 3 && distinct[2].score > top.score * 0.6) {
    const options = distinct.slice(0, 3);
    return {
      kind: 'clarify',
      text: `That could mean a few different things. Which of these are you asking about: ${options
        .map((h, i) => `${locatorName(h.chunk)} [${i + 1}]`)
        .join(', ')}?`,
      citations: options.map((h, i) => makeCitation(i + 1, h.chunk, bestExcerpt(h.chunk.text, question, 1))),
      evidence: 'partial',
      evidenceReason: 'The question matches several topics, so the assistant asks which one you mean.',
      method: 'extractive',
      showHandover: false,
      suggestions: options.map((h) => `Tell me about ${locatorName(h.chunk).toLowerCase()}`),
    };
  }

  // Quote up to two strong, non-duplicate passages.
  const used: Hit[] = [top];
  for (const h of hits.slice(1)) {
    if (used.length >= 2) break;
    if (h.score < top.score * 0.7 || h.coverage < 0.5) continue;
    const ex = bestExcerpt(h.chunk.text, question);
    if (used.some((u) => bestExcerpt(u.chunk.text, question) === ex)) continue;
    used.push(h);
  }
  const citations: Citation[] = used.map((h, i) => makeCitation(i + 1, h.chunk, bestExcerpt(h.chunk.text, question)));
  const evidence = evidenceFromCoverage(top.coverage, top.matched.length);
  const lines = citations.map((c) => {
    const where = c.locator.kind === 'faq' ? 'Your questions and answers say' : `${c.sourceTitle} says`;
    return `${where}: “${c.highlight.replace(/\s+/g, ' ')}” [${c.n}]`;
  });
  if (OUT_OF_SCOPE.test(question)) {
    lines.push('I can explain what the documents say, but I can’t approve or decide anything on the organisation’s behalf.');
  }
  return {
    kind: 'answer',
    text: lines.join('\n\n'),
    citations,
    evidence,
    evidenceReason: EVIDENCE_TEXT[evidence].basis,
    method: 'extractive',
    showHandover: evidence !== 'strong',
  };
}
