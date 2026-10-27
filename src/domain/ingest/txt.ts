import type { Chunk } from '../types';
import { normaliseWhitespace } from '../../lib/text';

const MAX_CHUNK = 1100;

/** A line is treated as a heading when it looks like one: short, no closing punctuation, and either
 *  markdown-style (#), numbered ("3. Casual leave"), or followed by body text. */
function isHeading(line: string, next: string | undefined): boolean {
  const l = line.trim();
  if (!l || l.length > 80) return false;
  if (/^#{1,4}\s+\S/.test(l)) return true;
  if (/[.:;,!?]$/.test(l)) return false;
  if (/^(\d+(\.\d+)*\.?|[IVX]+\.)\s+[A-Z]/.test(l)) return true;
  return Boolean(next && next.trim().length > l.length && /^[A-Z]/.test(l) && l.split(' ').length <= 8);
}

function splitLong(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const parts: string[] = [];
  let current = '';
  for (const para of text.split(/\n\n+/)) {
    if (current && (current + '\n\n' + para).length > MAX_CHUNK) {
      parts.push(current);
      current = para;
    } else current = current ? `${current}\n\n${para}` : para;
  }
  if (current) parts.push(current);
  return parts;
}

export interface Section {
  heading: string | null;
  body: string;
}

export function sectionise(raw: string): Section[] {
  const text = normaliseWhitespace(raw);
  const lines = text.split('\n');
  const sections: Section[] = [];
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    const b = body.join('\n').trim();
    if (b) sections.push({ heading, body: b });
    body = [];
  };
  lines.forEach((line, i) => {
    const next = lines.slice(i + 1).find((x) => x.trim());
    if (isHeading(line, next)) {
      flush();
      heading = line.replace(/^#{1,4}\s+/, '').trim();
    } else body.push(line);
  });
  flush();
  return sections;
}

export function chunkSections(sections: Section[], sourceId: string): Chunk[] {
  const chunks: Chunk[] = [];
  let paragraphOrdinal = 0;
  sections.forEach((s, si) => {
    const pieces = s.heading ? splitLong(s.body) : s.body.split(/\n\n+/).flatMap(splitLong);
    pieces.forEach((piece, pi) => {
      const id = `${sourceId}#${chunks.length + 1}`;
      if (s.heading) {
        const heading = pieces.length > 1 ? `${s.heading} (part ${pi + 1})` : s.heading;
        chunks.push({ id, sourceId, text: piece, locator: { kind: 'section', heading, ordinal: si + 1 } });
      } else {
        paragraphOrdinal += 1;
        chunks.push({ id, sourceId, text: piece, locator: { kind: 'paragraph', ordinal: paragraphOrdinal } });
      }
    });
  });
  return chunks;
}

export function chunkPlainText(raw: string, sourceId: string): Chunk[] {
  return chunkSections(sectionise(raw), sourceId);
}
