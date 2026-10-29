import rules from '../../backend/catalog_rules.json';
import type { Source } from './types';

/** The browser demo and server use the same rule vocabulary; no model call or canned answer. */
export function describeSource(source: Source): Partial<Source> {
  const text = source.chunks.map(chunk => chunk.text).join('\n').slice(0, 120000).toLowerCase();
  const has = (term: string) => new RegExp(`(?:^|[^\\p{L}\\p{N}_])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
  const ranked = rules.categories.map(category => ({ score: category.terms.filter(has).length, label: category.label })).sort((a, b) => b.score - a.score);
  const label = ranked[0]?.score ? ranked[0].label : ({ XLSX: 'Spreadsheet', PPTX: 'Presentation', Image: 'Scanned information', Audio: 'Speech transcript', Video: 'Speech transcript', CSV: 'Table data' } as Record<string, string>)[source.fileType] ?? 'Reference document';
  const topics = rules.topics.filter(topic => topic.terms.some(has));
  const headings = [...new Set(source.chunks.map(chunk => chunk.locator.kind === 'section' ? chunk.locator.heading : chunk.locator.kind === 'sheet' ? chunk.locator.sheet : '').map(heading => heading.replace(/^\d+(\.\d+)*\.?\s*/, '').trim()).filter(heading => heading.length >= 3 && heading.length <= 60 && !/^(document|table\s*\d+|image\s*\d+.*|paragraph\s*\d+)$/i.test(heading)))];
  const questions = topics.slice(0, 3).map(topic => `${topic.question} (Source: ${source.title.slice(0, 100)})`);
  for (const heading of headings) { if (questions.length >= 4) break; questions.push(`What does "${heading}" cover in "${source.title.slice(0, 100)}"?`); }
  if (!questions.length) questions.push(`What information is available in "${source.title.slice(0, 100)}"?`);
  return { documentLabel: label, autoTags: [...new Set([label, ...topics.map(topic => topic.tag), ...headings.slice(0, 3)])].slice(0, 8), suggestedQuestions: questions.slice(0, 4), catalogMethod: rules.version, cataloguedAt: new Date().toISOString() };
}
