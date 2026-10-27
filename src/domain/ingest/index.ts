import type { Chunk, FileType, Source } from '../types';
import { sha256 } from '../../lib/hash';
import { chunkPlainText } from './txt';

export const ACCEPTED = '.pdf,.docx,.txt,.md,.csv';
export const MAX_BYTES = 15 * 1024 * 1024;

export function fileTypeOf(name: string): FileType | null {
  const ext = name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'PDF';
  if (ext === 'docx') return 'DOCX';
  if (ext === 'txt' || ext === 'md') return 'TXT';
  if (ext === 'csv') return 'CSV';
  return null;
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || name;
}

export type PreCheck =
  | { ok: true; type: FileType; hash: string; data: ArrayBuffer }
  | { ok: false; reason: string; duplicateOf?: string };

/** Checks that run before extraction: format, size, emptiness and exact duplicates. */
export async function precheckFile(file: File, existing: Source[], ignoreId?: string): Promise<PreCheck> {
  if (file.name.toLowerCase().endsWith('.doc')) {
    return { ok: false, reason: 'Older Word files (.doc) cannot be read. Save it as .docx and try again.' };
  }
  const type = fileTypeOf(file.name);
  if (!type) {
    return {
      ok: false,
      reason: `“${file.name}” is not a supported format. Use PDF, Word (.docx), text (.txt) or a question-and-answer CSV.`,
    };
  }
  if (file.size === 0) return { ok: false, reason: 'This file is empty.' };
  if (file.size > MAX_BYTES) return { ok: false, reason: 'This file is larger than 15 MB.' };
  const data = await file.arrayBuffer();
  const hash = await sha256(data);
  const dup = existing.find((s) => s.hash === hash && s.id !== ignoreId);
  if (dup) return { ok: false, reason: `This is the same file as “${dup.title}”.`, duplicateOf: dup.id };
  return { ok: true, type, hash, data };
}

export interface Extraction {
  chunks: Chunk[];
  note: string;
  attention?: string;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export async function extractFile(type: FileType, data: ArrayBuffer, sourceId: string): Promise<Extraction> {
  if (type === 'TXT') {
    const text = new TextDecoder('utf-8').decode(data);
    if (!text.trim()) return { chunks: [], note: '', attention: 'This file has no readable text.' };
    const chunks = chunkPlainText(text, sourceId);
    return { chunks, note: `Read directly from the text file: ${plural(chunks.length, 'passage')}, referenced by heading or paragraph.` };
  }
  if (type === 'PDF') {
    const { extractPdf } = await import('./pdf');
    const r = await extractPdf(data, sourceId);
    if (r.pagesWithText === 0) {
      return {
        chunks: [],
        note: '',
        attention:
          'No text could be read. This looks like a scanned or image-only PDF, which Anvesha cannot read yet. Upload a text-based PDF, or paste the content with “Write information”.',
      };
    }
    const skipped = r.pageCount - r.pagesWithText;
    return {
      chunks: r.chunks,
      note:
        `Text read from ${r.pagesWithText} of ${plural(r.pageCount, 'page')} using pdf.js.` +
        (r.hasPrintedLabels ? ' This PDF stores printed page labels; they are shown next to the page position.' : '') +
        (skipped ? ` ${plural(skipped, 'page')} had no readable text and will not be used.` : ''),
      attention: skipped / r.pageCount > 0.5 ? 'Most pages have no readable text, so answers may be incomplete.' : undefined,
    };
  }
  if (type === 'DOCX') {
    const { extractDocx } = await import('./docx');
    const chunks = await extractDocx(data, sourceId);
    if (!chunks.length) return { chunks: [], note: '', attention: 'This Word document has no readable text.' };
    return { chunks, note: 'Text read from the Word document. Word files have no fixed pages, so references use section headings.' };
  }
  return { chunks: [], note: '', attention: 'CSV files are imported as questions and answers.' };
}
