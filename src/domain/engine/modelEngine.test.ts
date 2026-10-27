import { afterEach, describe, expect, it, vi } from 'vitest';
import * as op from '../operations';
import { viewFromDraft } from '../knowledge';
import { modelEngine, EngineError } from './index';
import { DEMO_QUESTIONS } from '../../demo/vayutech';

function sampleView() {
  const { state, assistantId } = op.seedSample(op.emptyState(), 'ready');
  const a = state.assistants.find((x) => x.id === assistantId)!;
  return viewFromDraft(a, op.instructionsFor(state, a));
}

function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const f = vi.fn(impl);
  vi.stubGlobal('fetch', f);
  return f;
}

afterEach(() => vi.unstubAllGlobals());

describe('model engine (browser side of the server boundary)', () => {
  it('sends only the question, instructions and retrieved passages — never a key', async () => {
    const f = stubFetch(async () => new Response(JSON.stringify({ text: 'You get 18 days of annual leave. [S1]' })));
    await modelEngine.answer(sampleView(), DEMO_QUESTIONS.supported);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('/api/answer');
    const body = JSON.parse(init!.body as string);
    expect(Object.keys(body).sort()).toEqual(['instructions', 'passages', 'question']);
    expect(body.passages.length).toBeGreaterThan(0);
    expect(JSON.stringify(init!.headers)).not.toMatch(/api-key|authorization/i);
  });

  it('maps [S#] markers to numbered citations, keeping only cited passages', async () => {
    stubFetch(async (_u, init) => {
      const { passages } = JSON.parse(init!.body as string);
      const annual = passages.findIndex((p: { text: string }) => p.text.includes('18 days')) + 1;
      return new Response(JSON.stringify({ text: `You get 18 days of paid annual leave. [S${annual}] [S99]` }));
    });
    const ans = await modelEngine.answer(sampleView(), DEMO_QUESTIONS.supported);
    expect(ans.method).toBe('model');
    expect(ans.text).toBe('You get 18 days of paid annual leave. [1]');
    expect(ans.citations).toHaveLength(1);
    expect(ans.citations[0].excerpt).toContain('18 days');
    expect(ans.citations[0].excerpt).toContain(ans.citations[0].highlight);
  });

  it('treats an uncited model answer as having no supporting source', async () => {
    stubFetch(async () => new Response(JSON.stringify({ text: 'Probably 20 days.' })));
    const ans = await modelEngine.answer(sampleView(), DEMO_QUESTIONS.supported);
    expect(ans.evidence).toBe('none');
    expect(ans.citations).toHaveLength(0);
  });

  it('does not call the model when nothing relevant is retrieved', async () => {
    const f = stubFetch(async () => new Response('{}'));
    const ans = await modelEngine.answer(sampleView(), DEMO_QUESTIONS.unsupported);
    expect(f).not.toHaveBeenCalled();
    expect(ans.kind).toBe('no-info');
  });

  it('raises a readable EngineError on service failures, so the UI can keep the question and offer retry', async () => {
    stubFetch(async () => new Response(JSON.stringify({ error: 'Too many questions in a short time.' }), { status: 429 }));
    await expect(modelEngine.answer(sampleView(), DEMO_QUESTIONS.supported)).rejects.toThrow('Too many questions');
    stubFetch(async () => {
      throw new TypeError('offline');
    });
    await expect(modelEngine.answer(sampleView(), DEMO_QUESTIONS.supported)).rejects.toBeInstanceOf(EngineError);
  });
});
