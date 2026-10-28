import { describe, expect, it } from 'vitest';
import { suggestedQuestions } from './suggestions';
import type { Source } from '../../domain/types';

describe('source-driven chat suggestions', () => {
  it('uses the readable OCR title instead of Image 1 (OCR)', () => {
    const source: Source = { id: 'image', title: 'Uploaded photo', fileType: 'Image', status: 'ready', visibility: 'internal',
      origin: 'upload', addedAt: '', chunks: [{ id: 'c1', sourceId: 'image', text: 'Critique of Pure Reason\nEvery beginning is in time.',
        locator: { kind: 'section', heading: 'Image 1 (OCR)', ordinal: 1 } }] };
    const questions = suggestedQuestions([source], [], false, 5);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions[0]).toContain('Critique of Pure Reason');
    expect(questions.join(' ')).not.toMatch(/image 1|ocr/i);
  });
});
