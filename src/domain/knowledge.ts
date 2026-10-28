import type { Assistant, Chunk, Conflict, FaqEntry, Handover, Locator, Snapshot, Source, Tone } from './types';

/** Everything an answer engine may read. Built from either the editable draft or a published snapshot. */
export interface KnowledgeView {
  kind: 'draft' | 'published';
  assistantName: string;
  instructions: string;
  handover: Handover;
  tone: Tone;
  sources: Source[];
  faqs: FaqEntry[];
  conflicts: Conflict[];
  isSample: boolean;
  revision: number; // draft revision or snapshot version
}

export interface IndexedChunk extends Chunk {
  source: Pick<Source, 'id' | 'title' | 'fileType' | 'reviewBy' | 'sampleKey' | 'visibility'>;
}

export const FAQ_SOURCE_ID = 'faq';

export function faqChunk(f: FaqEntry): Chunk {
  return {
    id: `faq#${f.id}`,
    sourceId: FAQ_SOURCE_ID,
    text: `${f.question}\n\n${f.answer}`,
    locator: { kind: 'faq', entryId: f.id, code: f.code, question: f.question },
  };
}

/** Sources that are replaced by another included source are left out of retrieval. */
export function supersededIds(sources: Source[]): Set<string> {
  const ids = new Set(sources.map((s) => s.id));
  return new Set(sources.filter((s) => s.supersedes && ids.has(s.supersedes)).map((s) => s.supersedes!));
}

export function buildIndex(view: KnowledgeView): IndexedChunk[] {
  const superseded = supersededIds(view.sources);
  const excludedChunks = new Set<string>();
  for (const c of view.conflicts) {
    if (c.resolution?.kind === 'prefer') {
      const loser = c.resolution.sourceId === c.a.sourceId ? c.b : c.a;
      excludedChunks.add(loser.chunkId);
    }
  }
  const out: IndexedChunk[] = [];
  for (const s of view.sources) {
    if (s.status !== 'ready' || superseded.has(s.id)) continue;
    const meta = { id: s.id, title: s.title, fileType: s.fileType, reviewBy: s.reviewBy, sampleKey: s.sampleKey, visibility: s.visibility };
    for (const c of s.chunks) if (!excludedChunks.has(c.id)) out.push({ ...c, source: meta });
  }
  for (const f of view.faqs) {
    if (!f.approved) continue;
    out.push({
      ...faqChunk(f),
      source: { id: FAQ_SOURCE_ID, title: 'Questions and answers', fileType: 'Written', visibility: f.visibility },
    });
  }
  return out;
}

export function viewFromDraft(a: Assistant, instructions: string): KnowledgeView {
  return {
    kind: 'draft',
    assistantName: a.draft.name,
    instructions,
    handover: a.draft.handover,
    tone: a.draft.tone,
    sources: a.draft.sources,
    faqs: a.draft.faqs,
    conflicts: a.draft.conflicts,
    isSample: a.isSample,
    revision: a.draftRevision,
  };
}

export function viewFromSnapshot(s: Snapshot, isSample: boolean): KnowledgeView {
  return {
    kind: 'published',
    assistantName: s.name,
    instructions: s.instructions,
    handover: s.handover,
    tone: s.tone,
    sources: s.sources,
    faqs: s.faqs,
    conflicts: s.conflicts,
    isSample,
    revision: s.version,
  };
}

/** Human-readable reference. PDF physical position and printed page label are kept distinct. */
export function formatLocator(l: Locator): string {
  switch (l.kind) {
    case 'pdf':
      return l.pageLabel ? `PDF page ${l.pageIndex} · printed page “${l.pageLabel}”` : `Page ${l.pageIndex}`;
    case 'section':
      return `Section: ${l.heading}`;
    case 'paragraph':
      return `Paragraph ${l.ordinal}`;
    case 'faq':
      return `${l.code}`;
  }
}

export function isOutdated(reviewBy: string | undefined, today = new Date()): boolean {
  if (!reviewBy) return false;
  return new Date(reviewBy + 'T23:59:59') < today;
}
