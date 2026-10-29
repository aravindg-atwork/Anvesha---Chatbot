import { describe, expect, it } from 'vitest';
import { describeSource } from './catalog';
import { suggestedQuestions } from '../ui/chat/suggestions';
import type { Source } from './types';

const source = (text: string): Source => ({ id: 'guide', title: 'Product guide', fileType: 'TXT', status: 'ready', origin: 'upload', addedAt: '2026-10-29T00:00:00Z', visibility: 'internal', tags: ['My reference'], chunks: [{ id: 'guide:c1', sourceId: 'guide', text, locator: { kind: 'paragraph', ordinal: 1 } }] });

describe('automatic source organization', () => {
  it('replaces obsolete suggested topics when a source changes without overwriting owner tags', () => {
    const warranty = source('Product warranty covers the supplied adapter for 24 months.');
    const organized = { ...warranty, ...describeSource(warranty) };
    expect(organized.autoTags).toContain('Warranty');
    expect(organized.suggestedQuestions?.some(question => /warranty/i.test(question))).toBe(true);
    const changed = { ...organized, chunks: source('Invoice payment is due within 30 days.').chunks };
    const refreshed = { ...changed, ...describeSource(changed) };
    expect(refreshed.autoTags).toContain('Payment');
    expect(refreshed.autoTags).not.toContain('Warranty');
    expect(refreshed.tags).toEqual(['My reference']);
    expect(refreshed.suggestedQuestions?.join(' ')).not.toMatch(/warranty/i);
  });

  it('does not suggest questions from reading, failed or superseded documents', () => {
    const original = { ...source('Warranty documentation.'), ...describeSource(source('Warranty documentation.')) };
    const reading = { ...original, id: 'reading', status: 'reading' as const };
    const replacement = { ...source('Payment invoice details.'), id: 'replacement', supersedes: original.id };
    Object.assign(replacement, describeSource(replacement));
    const questions = suggestedQuestions([original, reading, replacement], [], false, 3);
    expect(questions.join(' ')).toMatch(/payment/i);
    expect(questions.join(' ')).not.toMatch(/warranty/i);
  });
});
