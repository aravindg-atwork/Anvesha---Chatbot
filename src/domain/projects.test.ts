import { describe, expect, it } from 'vitest';
import * as op from './operations';
import { migrate } from './store';
import { answerExtractive } from './engine/extractive';
import { viewFromDraft } from './knowledge';
import { DEMO_QUESTIONS } from '../demo/vayutech';
import type { AppState } from './types';

const get = (s: AppState, id: string) => s.assistants.find((x) => x.id === id)!;

function project() {
  const { state, orgId } = op.createWorkspace(op.emptyState(), 'VayuTech');
  const r = op.createProject(state, orgId, { name: '', description: 'Help employees understand our leave policy and benefits.', starter: 'employee' });
  return { state: r.state, id: r.assistantId };
}

describe('workspace and projects', () => {
  it('creates a workspace without a project, and a project with a suggested identity', () => {
    const { state, orgId } = op.createWorkspace(op.emptyState(), '  VayuTech ');
    expect(state.orgs[0].name).toBe('VayuTech');
    expect(state.assistants).toHaveLength(0);
    const { state: s2, assistantId } = op.createProject(state, orgId, { name: 'People Desk', description: 'answer staff questions', starter: null });
    const a = get(s2, assistantId);
    expect(a.draft.name).toBe('People Desk');
    expect(a.draft.greeting).toContain('People Desk');
    expect(a.draft.purpose).toBe('Answer staff questions.');
    expect(a.currentStep).toBe('upload');
  });

  it('suggests a name when none is given', () => {
    const { state, id } = project();
    expect(get(state, id).draft.name).toBe('AskHR');
  });
});

describe('sample documents in a new project', () => {
  it('enables the scripted story and adds the annotated conflict, without duplicates', () => {
    const { state, id } = project();
    let s = op.addSampleDocuments(state, id);
    s = op.addSampleDocuments(s, id);
    const a = get(s, id);
    expect(a.isSample).toBe(true);
    expect(a.draft.sources.filter((x) => x.sampleKey === 'leave-2025')).toHaveLength(1);
    expect(a.draft.conflicts).toHaveLength(1);
    expect(new Set(a.draft.faqs.map((f) => f.code)).size).toBe(a.draft.faqs.length);
    const ans = answerExtractive(viewFromDraft(a, op.instructionsFor(s, a)), DEMO_QUESTIONS.emergency);
    expect(ans.method).toBe('scripted-demo');
  });
});

describe('training', () => {
  it('is needed after information changes and cleared once trained', () => {
    const { state, id } = project();
    let s = op.addSampleDocuments(state, id);
    expect(op.needsTraining(get(s, id))).toBe(true);
    s = op.markTrained(s, id);
    expect(op.needsTraining(get(s, id))).toBe(false);
    // Resolving a conflict changes behaviour, not information: no retraining.
    const c = get(s, id).draft.conflicts[0];
    s = op.resolveConflict(s, id, c.id, { kind: 'both' });
    expect(op.needsTraining(get(s, id))).toBe(false);
    s = op.removeSource(s, id, get(s, id).draft.sources[0].id);
    expect(op.needsTraining(get(s, id))).toBe(true);
  });
});

describe('tone', () => {
  it('changes the wording of demo answers and the generated instructions', () => {
    const { state, id } = project();
    let s = op.addSampleDocuments(state, id);
    const text = (st: AppState) => {
      const a = get(st, id);
      return answerExtractive(viewFromDraft(a, op.instructionsFor(st, a)), DEMO_QUESTIONS.emergency).text;
    };
    expect(text(s)).toContain('I’m sorry to hear');
    s = op.updateDraft(s, id, { tone: 'formal' });
    expect(text(s)).toContain('I am sorry for the difficult circumstances');
    expect(op.instructionsFor(s, get(s, id))).toContain('formal');
    s = op.updateDraft(s, id, { tone: 'concise' });
    expect(text(s)).not.toContain('sorry');
    expect(text(s)).toContain('Only HR can approve or reject leave.');
  });
});

describe('migration from the first prototype', () => {
  it('maps old steps and adds new fields without losing data', () => {
    const { state, assistantId } = op.seedSample(op.emptyState(), 'ready');
    const v1 = JSON.parse(JSON.stringify(state));
    v1.schemaVersion = 1;
    const a = v1.assistants.find((x: { id: string }) => x.id === assistantId);
    a.currentStep = 'knowledge';
    a.completedSteps = ['describe', 'knowledge', 'review', 'try'];
    delete a.trainedSignature;
    delete a.draft.tone;
    delete a.draft.avatar;
    delete a.draft.starterQuestions;
    const m = migrate(v1)!;
    const b = get(m, assistantId);
    expect(m.schemaVersion).toBe(op.SCHEMA_VERSION);
    expect(b.currentStep).toBe('upload');
    expect(b.completedSteps).toEqual(expect.arrayContaining(['upload', 'review', 'try', 'training']));
    expect(b.draft.tone).toBe('friendly');
    expect(b.draft.sources).toHaveLength(a.draft.sources.length);
    expect(op.needsTraining(b)).toBe(false);
  });

  it('refuses unknown future versions instead of guessing', () => {
    expect(migrate({ schemaVersion: 99 })).toBeNull();
  });
});
