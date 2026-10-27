// Small, dependency-free text utilities used by retrieval and conflict checks.

const STOP = new Set(
  `a an and are as at be been but by can could do does did for from had has have how i if in into is it its
  me my of on or our so that the their them then there these they this to was we were what when where which
  who will with would you your yours am get got any all also about may might much many should shall than
  just like want need please tell know more some such very not no yes up out off over under again`
    .split(/\s+/)
    .filter(Boolean),
);

/** Very light stemmer: enough to match "policies"/"policy", "days"/"day", "hospitalised"/"hospital". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ised')) w = w.slice(0, -4);
  else if (w.length > 5 && w.endsWith('ized')) w = w.slice(0, -4);
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('es') && /(ss|sh|ch|x)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => !STOP.has(t) && t.length > 1).map(stem);
}

export function uniqueTerms(text: string): string[] {
  return Array.from(new Set(tokenize(text)));
}

export function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

export function numbersIn(text: string): string[] {
  return Array.from(new Set(text.match(/\b\d+(?:\.\d+)?\b/g) ?? []));
}

export function normaliseWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
