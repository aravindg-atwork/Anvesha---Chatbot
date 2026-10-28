import type { Assistant, Audience, Snapshot, Source, FaqEntry } from './types';
import { isOutdated, supersededIds } from './knowledge';
import { uid, nowIso } from '../lib/id';

export interface PublicationPlan {
  included: Source[];
  excluded: { source: Source; reason: string }[];
  faqsIncluded: FaqEntry[];
  faqsExcluded: { faq: FaqEntry; reason: string }[];
  warnings: string[];
  blocking: string[];
}

/** Decide exactly what a publication would contain. Internal-only material never enters a public snapshot. */
export function planPublication(a: Assistant, audience: Audience): PublicationPlan {
  const d = a.draft;
  const superseded = supersededIds(d.sources);
  const included: Source[] = [];
  const excluded: PublicationPlan['excluded'] = [];
  for (const s of d.sources) {
    if (s.status !== 'ready') excluded.push({ source: s, reason: s.status === 'reading' ? 'Still being read' : 'Needs attention' });
    else if (audience === 'public' && s.visibility !== 'public') excluded.push({ source: s, reason: 'Internal only' });
    else if (superseded.has(s.id)) excluded.push({ source: s, reason: 'Replaced by a newer version' });
    else included.push(s);
  }
  const faqsIncluded: FaqEntry[] = [];
  const faqsExcluded: PublicationPlan['faqsExcluded'] = [];
  for (const f of d.faqs) {
    if (!f.approved) faqsExcluded.push({ faq: f, reason: 'Answer not approved yet' });
    else if (audience === 'public' && f.visibility !== 'public') faqsExcluded.push({ faq: f, reason: 'Internal only' });
    else faqsIncluded.push(f);
  }

  const warnings: string[] = [];
  const blocking: string[] = [];
  if (!included.length && !faqsIncluded.length) blocking.push('Nothing would be available to answer from. Add information or mark some as public.');
  const includedIds = new Set(included.map((s) => s.id));
  const open = d.conflicts.filter((c) => !c.resolution && includedIds.has(c.a.sourceId) && includedIds.has(c.b.sourceId));
  if (open.length) warnings.push(`${open.length} unresolved conflict${open.length > 1 ? 's' : ''}: answers will show both versions until you choose one.`);
  const outdated = included.filter((s) => isOutdated(s.reviewBy));
  if (outdated.length) warnings.push(`${outdated.map((s) => `“${s.title}”`).join(', ')} ${outdated.length > 1 ? 'are' : 'is'} past ${outdated.length > 1 ? 'their' : 'its'} review date.`);
  if (audience === 'public' && excluded.some((e) => e.reason === 'Internal only')) {
    warnings.push('Internal-only information is left out of this public version.');
  }
  if (!d.handover.contact.trim()) warnings.push('No contact for further help is set, so people will only be told to contact you directly.');
  return { included, excluded, faqsIncluded, faqsExcluded, warnings, blocking };
}

export function createSnapshot(a: Assistant, audience: Audience, instructions: string): Snapshot {
  const plan = planPublication(a, audience);
  const ids = new Set(plan.included.map((s) => s.id));
  const version = (a.history.at(-1)?.version ?? 0) + 1;
  // structuredClone guarantees later draft edits cannot reach the published copy.
  return structuredClone({
    id: uid('snap'),
    version,
    publishedAt: nowIso(),
    draftRevision: a.draftRevision,
    audience,
    name: a.draft.name,
    purpose: a.draft.purpose,
    greeting: a.draft.greeting,
    language: a.draft.language,
    instructions,
    handover: a.draft.handover,
    tone: a.draft.tone,
    starterQuestions: a.draft.starterQuestions,
    sources: plan.included,
    faqs: plan.faqsIncluded,
    conflicts: a.draft.conflicts.filter((c) => ids.has(c.a.sourceId) && ids.has(c.b.sourceId)),
    widget: a.share.widget,
  });
}

/** True when the draft has changed since the live snapshot was taken. */
export function hasUnpublishedChanges(a: Assistant): boolean {
  return Boolean(a.published && a.published.draftRevision !== a.draftRevision);
}
