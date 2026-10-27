import type { Chunk } from '../types';
import { chunkSections, type Section } from './txt';

/** Word files have no fixed pages, so passages are referenced by their real section headings. */
export async function extractDocx(data: ArrayBuffer, sourceId: string): Promise<Chunk[]> {
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: data });
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const sections: Section[] = [];
  let heading: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (body.join('').trim()) sections.push({ heading, body: body.join('\n\n').trim() });
    body = [];
  };
  dom.body.querySelectorAll(':scope > *').forEach((el) => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (/^H[1-6]$/.test(el.tagName)) {
      flush();
      heading = text;
    } else if (el.tagName === 'UL' || el.tagName === 'OL') {
      body.push(Array.from(el.querySelectorAll('li')).map((li) => `• ${li.textContent?.trim()}`).join('\n'));
    } else body.push(text);
  });
  flush();
  return chunkSections(sections, sourceId);
}
