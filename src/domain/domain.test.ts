import { describe, expect, it } from 'vitest';
import * as op from './operations';
import { answerExtractive } from './engine/extractive';
import { buildIndex, viewFromDraft, viewFromSnapshot } from './knowledge';
import { chunkPlainText } from './ingest/txt';
import { parseFaqCsv, parseCsv } from './ingest/csv';
import { planPublication } from './publish';
import { DEMO_QUESTIONS, REQUIRED_PASSAGE } from '../demo/vayutech';
import type { AppState, Assistant, Source } from './types';

function sample(kind: 'ready' | 'published' = 'ready') {
  const { state, assistantId } = op.seedSample(op.emptyState(), kind);
  return { state, a: state.assistants.find((x) => x.id === assistantId)! };
}
const draftView = (s: AppState, a: Assistant) => viewFromDraft(a, op.instructionsFor(s, a));
const get = (s: AppState, id: string) => s.assistants.find((x) => x.id === id)!;

function textSource(id: string, title: string, text: string, extra: Partial<Source> = {}): Source {
  return {
    id,
    title,
    fileType: 'TXT',
    status: 'ready',
    chunks: chunkPlainText(text, id),
    visibility: 'internal',
    origin: 'upload',
    addedAt: new Date().toISOString(),
    ...extra,
  };
}

describe('ingestion', () => {
  it('splits text into sections with real headings', () => {
    const chunks = chunkPlainText('Annual leave\nYou get 18 days of annual leave.\n\nSick leave\nYou get 10 sick days.', 's1');
    expect(chunks.map((c) => c.locator)).toEqual([
      { kind: 'section', heading: 'Annual leave', ordinal: 1 },
      { kind: 'section', heading: 'Sick leave', ordinal: 2 },
    ]);
  });

  it('falls back to paragraph references when there are no headings', () => {
    const chunks = chunkPlainText('This is a long first paragraph of text.\n\nAnd a second paragraph follows here.', 's1');
    expect(chunks.every((c) => c.locator.kind === 'paragraph')).toBe(true);
  });

  it('parses quoted CSV fields', () => {
    expect(parseCsv('Question,Answer\n"Hi, there","He said ""yes"""\n')).toEqual([
      ['Question', 'Answer'],
      ['Hi, there', 'He said "yes"'],
    ]);
  });

  it('validates FAQ CSV columns, blanks and duplicates', () => {
    expect(parseFaqCsv('Q,A\nx,y').ok).toBe(false);
    const r = parseFaqCsv('Question,Answer\nWhen?,Monday\nWhen?,Tuesday\nWhy?,\n', ['Existing']);
    expect(r.rows.map((x) => x.problem)).toEqual([undefined, 'Duplicate question', 'Missing answer']);
  });
});

describe('demo answers', () => {
  it('answers the probation emergency question with the required passage and no decision', () => {
    const { state, a } = sample();
    const ans = answerExtractive(draftView(state, a), DEMO_QUESTIONS.emergency);
    expect(ans.method).toBe('scripted-demo');
    expect(ans.citations[0].highlight).toBe(REQUIRED_PASSAGE);
    expect(ans.citations[0].excerpt).toContain(REQUIRED_PASSAGE);
    expect(ans.text).toMatch(/not eligible|isn’t available/);
    expect(ans.text).toMatch(/HR/);
    expect(ans.text).not.toMatch(/\byou are approved\b|request is approved|rejected/i);
  });

  it('answers a supported question from the matching passage', () => {
    const { state, a } = sample();
    const ans = answerExtractive(draftView(state, a), DEMO_QUESTIONS.supported);
    expect(ans.kind).toBe('answer');
    expect(ans.text).toContain('18 days');
    expect(ans.evidence).toBe('strong');
    for (const c of ans.citations) expect(c.excerpt).toContain(c.highlight);
  });

  it('asks for clarification on the ambiguous question', () => {
    const { state, a } = sample();
    expect(answerExtractive(draftView(state, a), DEMO_QUESTIONS.ambiguous).kind).toBe('clarify');
  });

  it('admits when information is missing', () => {
    const { state, a } = sample();
    const ans = answerExtractive(draftView(state, a), DEMO_QUESTIONS.unsupported);
    expect(ans.kind).toBe('no-info');
    expect(ans.evidence).toBe('none');
  });

  it('shows both versions for an unresolved conflict, and only the preferred one once resolved', () => {
    const { state, a } = sample();
    const before = answerExtractive(draftView(state, a), DEMO_QUESTIONS.conflict);
    expect(before.kind).toBe('conflict');
    expect(before.text).toContain('8 days');
    expect(before.text).toContain('12 days');
    const c = a.draft.conflicts[0];
    const s2 = op.resolveConflict(state, a.id, c.id, { kind: 'prefer', sourceId: c.a.sourceId });
    const after = answerExtractive(draftView(s2, get(s2, a.id)), DEMO_QUESTIONS.conflict);
    expect(after.kind).toBe('answer');
    expect(after.text).toContain('8 days');
    expect(after.text).not.toContain('12 days');
  });
});

describe('isolation', () => {
  it('never answers uploaded content with the sample HR dataset', () => {
    let s = op.emptyState();
    const { state, assistantId } = op.createOrganisation(s, 'Greenfield College');
    s = op.addSource(state, assistantId, textSource('u1', 'Admissions', 'Application deadline\nApplications close on 30 June each year.'));
    const a = get(s, assistantId);
    const ans = answerExtractive(draftView(s, a), DEMO_QUESTIONS.emergency);
    expect(ans.method).not.toBe('scripted-demo');
    expect(ans.citations.every((c) => c.sourceId === 'u1')).toBe(true);
    expect(ans.text).not.toMatch(/casual leave|VayuTech/);
  });

  it('keeps sources separate between assistants', () => {
    const { state, a } = sample();
    const { state: s2, assistantId } = op.createOrganisation(state, 'Other Co');
    expect(buildIndex(draftView(s2, get(s2, assistantId)))).toHaveLength(0);
    expect(buildIndex(draftView(s2, get(s2, a.id))).length).toBeGreaterThan(0);
  });
});

describe('publication', () => {
  it('keeps the published snapshot unchanged when the draft is edited', () => {
    const { state, a } = sample('published');
    const before = answerExtractive(viewFromSnapshot(a.published!, true), DEMO_QUESTIONS.emergency).text;
    let s = op.updateDraft(state, a.id, { handover: { contact: 'NEW CONTACT 9999', process: '' } });
    s = op.removeSource(s, a.id, a.draft.sources[1].id);
    const edited = get(s, a.id);
    expect(answerExtractive(draftView(s, edited), DEMO_QUESTIONS.emergency).text).toContain('NEW CONTACT 9999');
    expect(answerExtractive(viewFromSnapshot(edited.published!, true), DEMO_QUESTIONS.emergency).text).toBe(before);
    expect(edited.published!.sources).toHaveLength(a.published!.sources.length);
  });

  it('excludes internal-only sources from a public publication', () => {
    const { state, a } = sample();
    let s = op.updateShare(state, a.id, { audience: 'public' });
    s = op.publish(s, a.id);
    const snap = get(s, a.id).published!;
    expect(snap.sources.every((x) => x.visibility === 'public')).toBe(true);
    expect(snap.faqs.every((x) => x.visibility === 'public')).toBe(true);
    const ans = answerExtractive(viewFromSnapshot(snap, true), DEMO_QUESTIONS.emergency);
    expect(ans.citations.every((c) => c.sourceId.endsWith('offices') || c.sourceId === 'faq')).toBe(true);
    expect(ans.method).not.toBe('scripted-demo');
  });

  it('flags superseded sources and unapproved FAQs in the publication plan', () => {
    const { state, a } = sample();
    let s = op.updateSource(state, a.id, a.draft.sources[0].id, { supersedes: a.draft.sources[1].id });
    s = op.addFaq(s, a.id, { question: 'Draft?', answer: 'Not yet', approved: false });
    const plan = planPublication(get(s, a.id), 'authorised');
    expect(plan.excluded.find((e) => e.source.id === a.draft.sources[1].id)?.reason).toMatch(/newer/);
    expect(plan.faqsExcluded[0].reason).toMatch(/not approved/);
  });

  it('increments versions and unpublishes', () => {
    const { state, a } = sample('published');
    let s = op.publish(state, a.id);
    expect(get(s, a.id).published!.version).toBe(2);
    s = op.unpublish(s, a.id);
    expect(get(s, a.id).status).toBe('unpublished');
  });
});

describe('persistence helpers', () => {
  it('recovers sources interrupted mid-read', () => {
    const { state, assistantId } = op.createOrganisation(op.emptyState(), 'X');
    const s = op.addSource(state, assistantId, textSource('r1', 'R', 'x', { status: 'reading', chunks: [] }));
    const recovered = op.recoverInterrupted(JSON.parse(JSON.stringify(s)));
    expect(get(recovered, assistantId).draft.sources[0].status).toBe('attention');
  });

  it('draft revisions only change when answer-affecting fields change', () => {
    const { state, a } = sample();
    expect(get(op.updateDraft(state, a.id, { greeting: 'Hi' }), a.id).draftRevision).toBe(a.draftRevision);
    expect(get(op.updateDraft(state, a.id, { behaviour: 'Be brief.' }), a.id).draftRevision).toBe(a.draftRevision + 1);
  });

  it('reset of sample data leaves customer organisations intact', () => {
    const { state } = sample();
    const { state: s2 } = op.createOrganisation(state, 'Real Co');
    const s3 = op.removeSampleData(s2);
    expect(s3.orgs.map((o) => o.name)).toEqual(['Real Co']);
  });
});

describe('excerpts', () => {
  it('keeps PDF-wrapped sentences whole and returns an exact substring', async () => {
    const { bestExcerpt } = await import('./retrieval');
    const text = 'Remote work\nEmployees may work remotely up to 2 days per week. Remote work is not available during the first\nmonth of employment.\n\nOther paragraph about remote things.';
    const ex = bestExcerpt(text, 'How many days per week can I work remotely?', 1);
    expect(text.includes(ex)).toBe(true);
    expect(ex).toBe('Remote work\nEmployees may work remotely up to 2 days per week.');
    const two = bestExcerpt(text, 'How many days per week can I work remotely?', 2);
    expect(two).toContain('the first\nmonth of employment.');
    expect(ex).not.toContain('Other paragraph');
  });
});

describe('decimal numbers', () => {
  it('does not split sentences at a decimal point', async () => {
    const { bestExcerpt } = await import('./retrieval');
    const text = 'Leave is earned at 1.5 days per month. Up to 6 days carry forward.';
    expect(bestExcerpt(text, 'how is leave earned per month', 1)).toBe('Leave is earned at 1.5 days per month.');
  });
});
