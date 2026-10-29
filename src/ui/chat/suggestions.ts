import type { FaqEntry, Source } from '../../domain/types';
import { DEMO_QUESTIONS } from '../../demo/vayutech';

/** Natural starter questions, drawn from the sources actually available. */
export function suggestedQuestions(sources: Source[], faqs: FaqEntry[], isSample: boolean, max = 4): string[] {
  if (isSample && sources.some((s) => s.sampleKey === 'leave-2025')) {
    return [DEMO_QUESTIONS.emergency, DEMO_QUESTIONS.supported, DEMO_QUESTIONS.ambiguous, DEMO_QUESTIONS.unsupported, DEMO_QUESTIONS.conflict].slice(0, max);
  }
  const out: string[] = [];
  const topics = new Set<string>();
  for (const f of faqs) if (f.approved && out.length < 2) out.push(f.question);
  const superseded = new Set(sources.map(source => source.supersedes).filter(Boolean));
  for (const source of sources) {
    if (source.status !== 'ready' || superseded.has(source.id)) continue;
    for (const question of source.suggestedQuestions ?? []) {
      if (out.length >= max) break;
      if (!out.includes(question)) out.push(question);
    }
  }
  for (const s of sources) {
    if (s.status !== 'ready' || superseded.has(s.id)) continue;
    for (const c of s.chunks) {
      if (out.length >= max) break;
      const generic = /^(image\s*\d+.*|page\s*\d+.*|document|paragraph\s*\d+|table\s*\d+|embedded image.*)$/i;
      const heading = c.locator.kind === 'section' ? c.locator.heading.replace(/^\d+(\.\d+)*\.?\s*/, '').replace(/\s*\(part \d+\)$/, '') : '';
      const firstLine = c.text.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
      const readableTitle = firstLine.length >= 4 && firstLine.length <= 85 && firstLine.split(/\s+/).length <= 12 && !/[.!?:;]$/.test(firstLine) && !generic.test(firstLine);
      const topic = heading && !generic.test(heading) ? heading : readableTitle ? firstLine : s.title;
      if (topic.length < 3 || topic.length > 100 || topics.has(topic.toLowerCase())) continue;
      topics.add(topic.toLowerCase());
      out.push(`What does “${topic}” say?`);
      if (out.length < max) out.push(`What are the main ideas in “${topic}”?`);
    }
  }
  if (out.length && out.length < max) out.push('Explain this in simple English.');
  return out.slice(0, max);
}

/** Owner-chosen starter questions when set (Make step), otherwise suggestions from the sources. */
export function starterQuestionsFor(custom: string[] | null | undefined, sources: Source[], faqs: FaqEntry[], isSample: boolean, max = 4): string[] {
  const own = (custom ?? []).map((q) => q.trim()).filter(Boolean);
  return own.length ? own.slice(0, max) : suggestedQuestions(sources, faqs, isSample, max);
}
