import type { Chunk } from '../types';
import { normaliseWhitespace } from '../../lib/text';

export interface PdfExtraction {
  pageCount: number;
  pagesWithText: number;
  chunks: Chunk[];
  hasPrintedLabels: boolean;
}

/** Extracts the text layer of each page with pdf.js. Page references come only from the file:
 *  pageIndex is the physical page number; pageLabel is the printed label stored in the PDF, if any. */
export async function extractPdf(data: ArrayBuffer, sourceId: string): Promise<PdfExtraction> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const labels = await doc.getPageLabels().catch(() => null);
  const chunks: Chunk[] = [];
  let pagesWithText = 0;
  let hasPrintedLabels = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : item.str.endsWith(' ') ? '' : ' ';
    }
    text = normaliseWhitespace(text);
    const label = labels?.[p - 1]?.trim() || undefined;
    if (label && label !== String(p)) hasPrintedLabels = true;
    if (text.length >= 20) {
      pagesWithText++;
      const paragraphs = text.split(/\n\n+/);
      let buf = '';
      const pieces: string[] = [];
      for (const para of paragraphs) {
        if (buf && (buf + '\n\n' + para).length > 1200) {
          pieces.push(buf);
          buf = para;
        } else buf = buf ? `${buf}\n\n${para}` : para;
      }
      if (buf) pieces.push(buf);
      for (const piece of pieces) {
        chunks.push({
          id: `${sourceId}#${chunks.length + 1}`,
          sourceId,
          text: piece,
          locator: { kind: 'pdf', pageIndex: p, pageLabel: label && label !== String(p) ? label : undefined },
        });
      }
    }
    page.cleanup();
  }
  const pageCount = doc.numPages;
  await task.destroy();
  return { pageCount, pagesWithText, chunks, hasPrintedLabels };
}
