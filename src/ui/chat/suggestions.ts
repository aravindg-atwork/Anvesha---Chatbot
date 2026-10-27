import type { FaqEntry, Source } from '../../domain/types';
import { DEMO_QUESTIONS } from '../../demo/vayutech';

/** Natural starter questions, drawn from the sources actually available. */
export function suggestedQuestions(sources: Source[], faqs: FaqEntry[], isSample: boolean, max = 4): string[] {
  if (isSample && sources.some((s) => s.sampleKey === 'leave-2025')) {
    return [DEMO_QUESTIONS.emergency, DEMO_QUESTIONS.supported, DEMO_QUESTIONS.ambiguous, DEMO_QUESTIONS.unsupported, DEMO_QUESTIONS.conflict].slice(0, max);
  }
  const out: string[] = [];
  for (const f of faqs) if (f.approved && out.length < 2) out.push(f.question);
  for (const s of sources) {
    if (s.status !== 'ready') continue;
    for (const c of s.chunks) {
      if (out.length >= max) break;
      if (c.locator.kind === 'section') {
        const topic = c.locator.heading.replace(/^\d+(\.\d+)*\.?\s*/, '').replace(/\s*\(part \d+\)$/, '');
        const q = `What does it say about ${topic.toLowerCase()}?`;
        if (topic.length > 2 && !out.includes(q)) out.push(q);
      }
    }
  }
  return out.slice(0, max);
}
