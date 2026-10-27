// Pure state operations. Each takes the current AppState and returns a new one.
// Kept free of React and storage so they can be unit tested.
import type {
  AppState,
  Assistant,
  AssistantDraft,
  Audience,
  Conflict,
  Conversation,
  ConversationChannel,
  FaqEntry,
  Message,
  Organisation,
  ShareSettings,
  Source,
  StepId,
} from './types';
import { STEPS } from './types';
import { uid, nowIso } from '../lib/id';
import { createSnapshot } from './publish';
import { effectiveInstructions, suggestIdentity } from './templates';
import { detectNumberConflicts, pruneConflicts } from './conflicts';
import { SAMPLE_ORG_NAME, buildSampleSources, sampleConflicts, sampleFaqs } from '../demo/vayutech';

export const SCHEMA_VERSION = 1;

export function emptyState(): AppState {
  return { schemaVersion: SCHEMA_VERSION, session: null, orgs: [], assistants: [], conversations: [], modelPreference: 'demo' };
}

const clone = <T,>(v: T): T => structuredClone(v);

function emptyDraft(): AssistantDraft {
  return {
    description: '',
    starter: null,
    name: '',
    purpose: '',
    language: 'English',
    greeting: '',
    behaviour: '',
    handover: { contact: '', process: '' },
    customInstructions: null,
    sources: [],
    faqs: [],
    conflicts: [],
  };
}

function newAssistant(orgId: string, isSample: boolean): Assistant {
  const t = nowIso();
  return {
    id: uid('ast'),
    orgId,
    createdAt: t,
    updatedAt: t,
    isSample,
    publicId: `pub_${uid().slice(0, 10)}`,
    setupComplete: false,
    completedSteps: [],
    currentStep: 'describe',
    draft: emptyDraft(),
    draftRevision: 1,
    status: 'draft',
    published: null,
    history: [],
    share: {
      audience: null,
      channel: null,
      widget: { color: '#1d3a5f', position: 'right', mode: 'floating', greeting: '' },
    },
  };
}

export function orgOf(s: AppState, a: Assistant): Organisation | undefined {
  return s.orgs.find((o) => o.id === a.orgId);
}

export function instructionsFor(s: AppState, a: Assistant): string {
  return effectiveInstructions(a.draft, orgOf(s, a)?.name ?? 'your organisation');
}

function withAssistant(s: AppState, id: string, fn: (a: Assistant) => void, bump = false): AppState {
  const next = clone(s);
  const a = next.assistants.find((x) => x.id === id);
  if (!a) return s;
  fn(a);
  a.updatedAt = nowIso();
  if (bump) a.draftRevision += 1;
  return next;
}

// ── Organisation and setup ────────────────────────────────────────────────

export function createOrganisation(s: AppState, name: string): { state: AppState; assistantId: string } {
  const next = clone(s);
  const org: Organisation = { id: uid('org'), name: name.trim(), createdAt: nowIso(), isSample: false };
  const a = newAssistant(org.id, false);
  next.orgs.push(org);
  next.assistants.push(a);
  return { state: next, assistantId: a.id };
}

export function addAssistant(s: AppState, orgId: string): { state: AppState; assistantId: string } {
  const next = clone(s);
  const org = next.orgs.find((o) => o.id === orgId);
  const a = newAssistant(orgId, Boolean(org?.isSample));
  next.assistants.push(a);
  return { state: next, assistantId: a.id };
}

/** Fields that change how the assistant answers. Editing them creates a new draft revision. */
const ANSWER_FIELDS: (keyof AssistantDraft)[] = ['name', 'purpose', 'behaviour', 'language', 'handover', 'customInstructions', 'sources', 'faqs', 'conflicts'];

export function updateDraft(s: AppState, id: string, patch: Partial<AssistantDraft>): AppState {
  const bump = Object.keys(patch).some((k) => ANSWER_FIELDS.includes(k as keyof AssistantDraft));
  return withAssistant(s, id, (a) => Object.assign(a.draft, clone(patch)), bump);
}

export function applySuggestion(s: AppState, id: string): AppState {
  const a = s.assistants.find((x) => x.id === id);
  if (!a) return s;
  const sug = suggestIdentity(a.draft.description, a.draft.starter, orgOf(s, a)?.name ?? 'Your organisation');
  return updateDraft(s, id, sug);
}

export function goToStep(s: AppState, id: string, step: StepId): AppState {
  return withAssistant(s, id, (a) => {
    a.currentStep = step;
  });
}

export function completeStep(s: AppState, id: string, step: StepId): AppState {
  return withAssistant(s, id, (a) => {
    if (!a.completedSteps.includes(step)) a.completedSteps.push(step);
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) a.currentStep = STEPS[i + 1];
  });
}

// ── Knowledge ────────────────────────────────────────────────────────────

function recheckConflicts(a: Assistant) {
  a.draft.conflicts = pruneConflicts(a.draft.conflicts, a.draft.sources);
  a.draft.conflicts.push(...detectNumberConflicts(a.draft.sources, a.draft.conflicts));
}

export function addSource(s: AppState, id: string, source: Source): AppState {
  return withAssistant(s, id, (a) => {
    a.draft.sources.push(clone(source));
    if (source.status === 'ready') recheckConflicts(a);
  }, true);
}

export function updateSource(s: AppState, id: string, sourceId: string, patch: Partial<Source>): AppState {
  return withAssistant(s, id, (a) => {
    const src = a.draft.sources.find((x) => x.id === sourceId);
    if (!src) return;
    Object.assign(src, clone(patch));
    if (patch.chunks || patch.status) recheckConflicts(a);
  }, true);
}

export function removeSource(s: AppState, id: string, sourceId: string): AppState {
  return withAssistant(s, id, (a) => {
    a.draft.sources = a.draft.sources.filter((x) => x.id !== sourceId);
    a.draft.sources.forEach((x) => {
      if (x.supersedes === sourceId) x.supersedes = undefined;
    });
    a.draft.conflicts = pruneConflicts(a.draft.conflicts, a.draft.sources);
  }, true);
}

function nextFaqCode(faqs: FaqEntry[]): string {
  const max = faqs.reduce((m, f) => Math.max(m, Number(f.code.replace(/\D/g, '')) || 0), 0);
  return `FAQ-${String(max + 1).padStart(2, '0')}`;
}

export function addFaq(
  s: AppState,
  id: string,
  entry: Pick<FaqEntry, 'question' | 'answer'> & Partial<Pick<FaqEntry, 'visibility' | 'approved' | 'createdFrom'>>,
): AppState {
  return withAssistant(s, id, (a) => {
    a.draft.faqs.push({
      id: uid('faq'),
      code: nextFaqCode(a.draft.faqs),
      question: entry.question.trim(),
      answer: entry.answer.trim(),
      visibility: entry.visibility ?? 'internal',
      approved: entry.approved ?? true,
      createdFrom: entry.createdFrom ?? 'manual',
    });
  }, true);
}

export function importFaqs(s: AppState, id: string, rows: { question: string; answer: string }[]): AppState {
  let next = s;
  for (const r of rows) next = addFaq(next, id, { ...r, createdFrom: 'csv' });
  return next;
}

export function updateFaq(s: AppState, id: string, faqId: string, patch: Partial<FaqEntry>): AppState {
  return withAssistant(s, id, (a) => {
    const f = a.draft.faqs.find((x) => x.id === faqId);
    if (f) Object.assign(f, patch);
  }, true);
}

export function removeFaq(s: AppState, id: string, faqId: string): AppState {
  return withAssistant(s, id, (a) => {
    a.draft.faqs = a.draft.faqs.filter((x) => x.id !== faqId);
  }, true);
}

export function resolveConflict(s: AppState, id: string, conflictId: string, resolution: Conflict['resolution']): AppState {
  return withAssistant(s, id, (a) => {
    const c = a.draft.conflicts.find((x) => x.id === conflictId);
    if (c) c.resolution = resolution;
  }, true);
}

// ── Sharing and publication ────────────────────────────────────────────────

export function updateShare(s: AppState, id: string, patch: Partial<ShareSettings>): AppState {
  return withAssistant(s, id, (a) => {
    Object.assign(a.share, clone(patch));
  });
}

export function publish(s: AppState, id: string): AppState {
  const a = s.assistants.find((x) => x.id === id);
  if (!a) return s;
  const audience: Audience = a.share.audience ?? 'authorised';
  const snap = createSnapshot(a, audience, instructionsFor(s, a));
  return withAssistant(s, id, (x) => {
    x.published = snap;
    x.history.push(snap);
    x.status = 'live';
    x.setupComplete = true;
    if (!x.completedSteps.includes('share')) x.completedSteps.push('share');
  });
}

export function unpublish(s: AppState, id: string): AppState {
  return withAssistant(s, id, (a) => {
    if (a.status === 'live') a.status = 'unpublished';
  });
}

// ── Conversations ────────────────────────────────────────────────────────

export function startConversation(s: AppState, assistantId: string, channel: ConversationChannel): { state: AppState; conversationId: string } {
  const next = clone(s);
  const c: Conversation = { id: uid('conv'), assistantId, channel, startedAt: nowIso(), messages: [] };
  next.conversations.push(c);
  return { state: next, conversationId: c.id };
}

export function appendMessage(s: AppState, conversationId: string, m: Message): AppState {
  const next = clone(s);
  next.conversations.find((c) => c.id === conversationId)?.messages.push(m);
  return next;
}

export function updateMessage(s: AppState, conversationId: string, messageId: string, patch: Partial<Message>): AppState {
  const next = clone(s);
  const m = next.conversations.find((c) => c.id === conversationId)?.messages.find((x) => x.id === messageId);
  if (m) Object.assign(m, patch);
  return next;
}

export function removeMessage(s: AppState, conversationId: string, messageId: string): AppState {
  const next = clone(s);
  const c = next.conversations.find((x) => x.id === conversationId);
  if (c) c.messages = c.messages.filter((m) => m.id !== messageId);
  return next;
}

// ── Demo data ────────────────────────────────────────────────────────────

export function removeSampleData(s: AppState): AppState {
  const next = clone(s);
  const sampleOrgIds = new Set(next.orgs.filter((o) => o.isSample).map((o) => o.id));
  const sampleAssistantIds = new Set(next.assistants.filter((a) => sampleOrgIds.has(a.orgId)).map((a) => a.id));
  next.orgs = next.orgs.filter((o) => !sampleOrgIds.has(o.id));
  next.assistants = next.assistants.filter((a) => !sampleAssistantIds.has(a.id));
  next.conversations = next.conversations.filter((c) => !sampleAssistantIds.has(c.assistantId));
  return next;
}

/** Replaces any existing sample with a fresh VayuTech AskHR, ready to test or already published. */
export function seedSample(s: AppState, kind: 'ready' | 'published'): { state: AppState; assistantId: string } {
  let next = removeSampleData(s);
  next = clone(next);
  const org: Organisation = { id: uid('org'), name: SAMPLE_ORG_NAME, createdAt: nowIso(), isSample: true };
  const a = newAssistant(org.id, true);
  const sources = buildSampleSources(a.id, nowIso());
  a.draft = {
    ...a.draft,
    description: 'Help employees understand our leave policy and benefits.',
    starter: 'employee',
    ...suggestIdentity('Help employees understand our leave policy and benefits.', 'employee', SAMPLE_ORG_NAME),
    sources,
    faqs: sampleFaqs(a.id),
    conflicts: sampleConflicts(sources),
  };
  a.completedSteps = ['describe', 'knowledge', 'review'];
  a.currentStep = 'try';
  next.orgs.push(org);
  next.assistants.push(a);
  if (!next.session) next.session = { kind: 'demo' };
  if (kind === 'published') {
    a.share.audience = 'authorised';
    a.share.channel = 'website';
    a.completedSteps = ['describe', 'knowledge', 'review', 'try'];
    a.draft.handover = { contact: 'the HR Care desk at hrcare@vayutech.example or extension 2040', process: '' };
    // Resolve the version conflict in favour of the 2025 edition before publishing.
    a.draft.conflicts.forEach((c) => (c.resolution = { kind: 'prefer', sourceId: c.a.sourceId }));
    const s2023 = a.draft.sources.find((x) => x.sampleKey === 'leave-2023');
    const s2025 = a.draft.sources.find((x) => x.sampleKey === 'leave-2025');
    if (s2023 && s2025) s2025.supersedes = s2023.id;
    a.draftRevision += 1;
    next = publish(next, a.id);
  }
  return { state: next, assistantId: a.id };
}

/** Marks sources left mid-read by a refresh, so they never sit in "Reading" forever. */
export function recoverInterrupted(s: AppState): AppState {
  if (!s.assistants.some((a) => a.draft.sources.some((x) => x.status === 'reading'))) return s;
  const next = clone(s);
  next.assistants.forEach((a) =>
    a.draft.sources.forEach((x) => {
      if (x.status === 'reading') {
        x.status = 'attention';
        x.attention = 'Reading was interrupted when the page reloaded. Choose the file again to retry.';
      }
    }),
  );
  return next;
}
