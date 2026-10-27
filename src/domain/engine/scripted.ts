import type { AnswerPayload } from '../types';
import type { IndexedChunk, KnowledgeView } from '../knowledge';
import { REQUIRED_PASSAGE } from '../../demo/vayutech';
import { makeCitation } from './common';
import { search } from '../retrieval';

/**
 * Scripted demonstration responses for the bundled VayuTech sample only.
 * They run only when the assistant is the sample AND the exact bundled passage is still
 * present in the knowledge being answered from. Otherwise the general engine answers.
 */

function findSection(index: IndexedChunk[], sampleKey: string, headingPrefix: string) {
  return index.find(
    (c) => c.source.sampleKey === sampleKey && c.locator.kind === 'section' && c.locator.heading.startsWith(headingPrefix),
  );
}

const RELATIVES = ['mother', 'father', 'parent', 'wife', 'husband', 'spouse', 'son', 'daughter', 'child', 'brother', 'sister', 'grandmother', 'grandfather'];

function handoverLine(view: KnowledgeView, fallback: string): string {
  const contact = view.handover.contact.trim();
  if (!contact) return fallback;
  const process = view.handover.process.trim();
  return `To start, contact ${contact}.${process ? ` ${process}` : ''}`;
}

function emergency(view: KnowledgeView, index: IndexedChunk[], question: string): AnswerPayload | null {
  const casual = findSection(index, 'leave-2025', '3.');
  if (!casual || !casual.text.includes(REQUIRED_PASSAGE)) return null;
  const q = question.toLowerCase();
  const who = RELATIVES.find((r) => q.includes(r));
  const citations = [makeCitation(1, casual, REQUIRED_PASSAGE)];
  const paragraphs = [
    `I’m sorry to hear ${who ? `your ${who} is in hospital` : 'about your family emergency'}. That must be a worrying time.`,
    'Because you’re on probation, casual leave isn’t available to you. [1]',
    'Family emergencies are handled differently: you can submit a request to HR, who will review your situation individually. Submitting a request doesn’t guarantee approval. [1]',
    handoverLine(view, 'To start, contact your HR team and explain your situation and the days you need.'),
  ];
  // If the owner has added a relevant approved Q&A, include it.
  const faq = search(index.filter((c) => c.locator.kind === 'faq'), question, 1)[0];
  if (faq && faq.coverage >= 0.5) {
    citations.push(makeCitation(2, faq.chunk, faq.chunk.text.split('\n\n').slice(1).join('\n\n')));
    paragraphs.push(`${faq.chunk.text.split('\n\n').slice(1).join(' ')} [2]`);
  }
  paragraphs.push('I can explain the policy, but I can’t approve or reject leave. That decision is made by HR.');
  return {
    kind: 'answer',
    text: paragraphs.join('\n\n'),
    citations,
    evidence: 'strong',
    evidenceReason: 'Every statement in this answer is taken from the highlighted policy passage.',
    method: 'scripted-demo',
    // The answer already names the contact when one is set; only add the generic help note otherwise.
    showHandover: !view.handover.contact.trim(),
  };
}

function ambiguousLeave(index: IndexedChunk[]): AnswerPayload | null {
  const annual = findSection(index, 'leave-2025', '2.');
  const casual = findSection(index, 'leave-2025', '3.');
  const sick = findSection(index, 'leave-2025', '4.');
  if (!annual || !casual || !sick) return null;
  return {
    kind: 'clarify',
    text: 'VayuTech has a few kinds of leave, and each has its own allowance. Which one do you mean: annual leave [1], casual leave [2] or sick leave [3]?',
    citations: [
      makeCitation(1, annual, 'Full-time employees receive 18 days of paid annual leave per calendar year.'),
      makeCitation(2, casual, 'Confirmed employees receive 8 days of casual leave per calendar year for short personal needs.'),
      makeCitation(3, sick, 'Employees receive 10 days of paid sick leave per calendar year, including during probation.'),
    ],
    evidence: 'partial',
    evidenceReason: 'The question matches several leave types, so the assistant asks which one you mean.',
    method: 'scripted-demo',
    showHandover: false,
    suggestions: ['How many days of annual leave do I get?', 'How many casual leave days do I get?', 'How many sick days do I get?'],
  };
}

export function scriptedAnswer(view: KnowledgeView, index: IndexedChunk[], question: string): AnswerPayload | null {
  if (!view.isSample) return null;
  const q = question.toLowerCase();
  if (/probation/.test(q) && /(hospital|emergency|mother|father|parent|family|sick relative|accident)/.test(q)) {
    return emergency(view, index, question);
  }
  if (/^\s*how (much|many)( days of)? leave (do|can|will) i (get|have|take)\??\s*$/.test(q)) {
    return ambiguousLeave(index);
  }
  return null;
}
