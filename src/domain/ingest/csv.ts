/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface FaqImportRow {
  line: number;
  question: string;
  answer: string;
  problem?: string;
}

export interface FaqImportResult {
  ok: boolean;
  error?: string;
  rows: FaqImportRow[];
}

export function parseFaqCsv(input: string, existingQuestions: string[] = []): FaqImportResult {
  const rows = parseCsv(input);
  if (!rows.length) return { ok: false, error: 'This file is empty.', rows: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const qi = header.indexOf('question');
  const ai = header.indexOf('answer');
  if (qi < 0 || ai < 0) {
    return { ok: false, error: 'The first row must contain columns named “Question” and “Answer”.', rows: [] };
  }
  const seen = new Set(existingQuestions.map((q) => q.trim().toLowerCase()));
  const out: FaqImportRow[] = rows.slice(1).map((r, i) => {
    const question = (r[qi] ?? '').trim();
    const answer = (r[ai] ?? '').trim();
    let problem: string | undefined;
    if (!question) problem = 'Missing question';
    else if (!answer) problem = 'Missing answer';
    else if (seen.has(question.toLowerCase())) problem = 'Duplicate question';
    if (!problem) seen.add(question.toLowerCase());
    return { line: i + 2, question, answer, problem };
  });
  if (!out.length) return { ok: false, error: 'The file has a header row but no questions.', rows: [] };
  return { ok: true, rows: out };
}
