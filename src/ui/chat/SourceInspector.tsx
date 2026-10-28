import { useEffect, useRef } from 'react';
import { CalendarClock, X } from 'lucide-react';
import type { Citation, Source } from '../../domain/types';
import { formatLocator, isOutdated } from '../../domain/knowledge';
import { formatDate } from '../components/ui';

function Highlighted({ text, highlight }: { text: string; highlight: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest' });
  }, [text, highlight]);
  const i = highlight ? text.indexOf(highlight) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark ref={ref}>{highlight}</mark>
      {text.slice(i + highlight.length)}
    </>
  );
}

function referenceDetail(c: Citation): string | null {
  if (c.locator.kind === 'pdf') {
    return c.locator.pageLabel
      ? `“PDF page” is the page’s position in the file. “Printed page” is the number printed on the page itself.`
      : 'Page position in the PDF file. This file does not store separate printed page numbers.';
  }
  if (c.locator.kind === 'faq') return `Question and answer entry ${c.locator.code}: “${c.locator.question}”`;
  if (c.locator.kind === 'section') return 'Section heading as it appears in the document.';
  if (c.locator.kind === 'paragraph') return 'This document has no headings, so the paragraph position is used.';
  return null;
}

export function SourceInspector({
  citations,
  active,
  onSelect,
  onClose,
  lookupSource,
  footer,
}: {
  citations: Citation[];
  active: number;
  onSelect: (n: number) => void;
  onClose: () => void;
  lookupSource: (id: string) => Source | undefined;
  footer?: React.ReactNode;
}) {
  const c = citations.find((x) => x.n === active) ?? citations[0];
  const src = c ? lookupSource(c.sourceId) : undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  if (!c) return null;
  const outdated = src && isOutdated(src.reviewBy);
  return (
    <aside className="inspector" aria-label="Sources for this answer">
      <div className="inspector-head">
        <h3 style={{ fontSize: '1.15rem' }}>Sources</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close sources" ref={closeRef}>
          <X size={20} />
        </button>
      </div>
      <div className="inspector-body">
        {citations.length > 1 && (
          <div className="cite-tabs" role="tablist" aria-label="Choose source">
            {citations.map((x) => (
              <button key={x.n} role="tab" aria-selected={x.n === c.n} className="chip" aria-pressed={x.n === c.n} onClick={() => onSelect(x.n)} style={{ minHeight: 40 }}>
                {x.n}. {x.locator.kind === 'faq' ? x.locator.code : x.sourceTitle.length > 28 ? x.sourceTitle.slice(0, 26) + '…' : x.sourceTitle}
              </button>
            ))}
          </div>
        )}
        <div className="ref-line">
          <span className="label">
            Source {c.n} · {c.fileType === 'Written' ? (c.locator.kind === 'faq' ? 'Question and answer' : 'Written') : c.fileType}
          </span>
          <strong style={{ fontSize: '1.1rem', overflowWrap: 'anywhere' }}>{c.sourceTitle}</strong>
          <span>{formatLocator(c.locator)}</span>
          <span className="faint small">{referenceDetail(c)}</span>
        </div>
        {outdated && (
          <div className="notice notice-warn small">
            <CalendarClock size={17} aria-hidden />
            <span>This source was due for review on {formatDate(src!.reviewBy)}. It may be out of date.</span>
          </div>
        )}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>
            Supporting passage
          </div>
          <div className="excerpt" tabIndex={0}>
            <Highlighted text={c.excerpt} highlight={c.highlight} />
          </div>
          <p className="faint small" style={{ marginTop: 8 }}>
            Highlighted text is the part the answer relies on. The rest is the surrounding passage, exactly as it was read from the source.
          </p>
        </div>
        {footer}
      </div>
    </aside>
  );
}
