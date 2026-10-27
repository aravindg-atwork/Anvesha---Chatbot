import type { AnswerPayload, Citation, EvidenceLevel } from '../types';
import type { IndexedChunk } from '../knowledge';

export function makeCitation(n: number, chunk: IndexedChunk, highlight: string): Citation {
  // Citation integrity: the highlight must be a real substring of the stored passage.
  const safe = highlight && chunk.text.includes(highlight) ? highlight : '';
  return {
    n,
    sourceId: chunk.source.id,
    sourceTitle: chunk.source.title,
    fileType: chunk.source.fileType,
    chunkId: chunk.id,
    locator: chunk.locator,
    excerpt: chunk.text,
    highlight: safe,
  };
}

export const EVIDENCE_TEXT: Record<EvidenceLevel, { label: string; basis: string }> = {
  strong: {
    label: 'Strong support',
    basis: 'The highlighted passage contains most of the key words in the question.',
  },
  partial: {
    label: 'Partial support',
    basis: 'The highlighted passage covers some, but not all, of the key words in the question.',
  },
  none: {
    label: 'No supporting source',
    basis: 'No passage in the current sources matched the question well enough.',
  },
};

export const EVIDENCE_CAVEAT =
  'This label comes from a word-match check between the question and the cited passage. It is not a guarantee that the answer is correct.';

export function evidenceFromCoverage(coverage: number, matched: number): EvidenceLevel {
  if (coverage >= 0.6 && matched >= 2) return 'strong';
  if (coverage >= 0.3) return 'partial';
  return 'none';
}

export function noInformation(question: string, closest?: Citation): AnswerPayload {
  return {
    kind: 'no-info',
    text: closest
      ? `I couldn’t find information that answers this in the current sources. The closest passage I found is linked below, but it doesn’t answer “${question.trim()}” directly. [1]`
      : 'I couldn’t find information that answers this in the current sources, so I’d rather not guess.',
    citations: closest ? [closest] : [],
    evidence: 'none',
    evidenceReason: EVIDENCE_TEXT.none.basis,
    method: 'limitation',
    showHandover: true,
  };
}
