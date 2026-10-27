import { GitCompareArrows } from 'lucide-react';
import type { Assistant, Conflict } from '../../../domain/types';
import { dispatch } from '../../../domain/store';
import * as op from '../../../domain/operations';
import { formatLocator } from '../../../domain/knowledge';
import { NUMBER_CHECK_LABEL } from '../../../domain/conflicts';
import { Button } from '../../components/ui';

/** Wraps numbers so the differences between versions stand out. */
function withNumbers(text: string) {
  return text.split(/(\b\d+(?:\.\d+)?\b)/g).map((p, i) => (/^\d/.test(p) ? <mark key={i}>{p}</mark> : p));
}

function ConflictCard({ a, c }: { a: Assistant; c: Conflict }) {
  const sides = [c.a, c.b].map((ref) => {
    const s = a.draft.sources.find((x) => x.id === ref.sourceId);
    const ch = s?.chunks.find((x) => x.id === ref.chunkId);
    return { s, ch };
  });
  const resolve = (r: Conflict['resolution']) => dispatch((st) => op.resolveConflict(st, a.id, c.id, r));
  const preferred = c.resolution?.kind === 'prefer' ? sides.find((x) => x.s?.id === (c.resolution as { sourceId: string }).sourceId)?.s : null;

  return (
    <li className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
      <div className="spread">
        <strong>{c.topic}</strong>
        {c.resolution ? (
          <span className="pill pill-ok">{preferred ? `Using “${preferred.title}”` : 'Answers mention both'}</span>
        ) : (
          <span className="pill pill-warn">Unresolved</span>
        )}
      </div>
      <p className="faint small">{c.detectedBy === 'sample-annotation' ? 'Conflict marked by hand in the sample data.' : NUMBER_CHECK_LABEL}</p>
      <div className="split" style={{ gap: 14 }}>
        {sides.map(({ s, ch }, i) => (
          <div key={i} className="panel stack" style={{ '--gap': '6px' } as React.CSSProperties}>
            <span className="ref-label" style={{ color: "var(--text)" }}>
              {s?.title}
            </span>
            {ch && <span className="faint small">{formatLocator(ch.locator)}</span>}
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>{ch ? withNumbers(ch.text) : 'Passage no longer available.'}</p>
          </div>
        ))}
      </div>
      <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
        {sides.map(({ s }) =>
          s ? (
            <Button key={s.id} size="sm" variant={preferred?.id === s.id ? 'primary' : 'secondary'} onClick={() => resolve({ kind: 'prefer', sourceId: s.id })}>
              Use {s.version ? `the ${s.version} version` : `“${s.title}”`}
            </Button>
          ) : null,
        )}
        <Button size="sm" variant={c.resolution?.kind === 'both' ? 'primary' : 'secondary'} onClick={() => resolve({ kind: 'both' })}>
          Mention both
        </Button>
        {c.resolution && (
          <button className="link-btn" onClick={() => resolve(null)}>
            Undo
          </button>
        )}
      </div>
    </li>
  );
}

export function ConflictList({ a }: { a: Assistant }) {
  if (!a.draft.conflicts.length) return null;
  const open = a.draft.conflicts.filter((c) => !c.resolution).length;
  return (
    <section className="stack" aria-label="Conflicts">
      <div className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
        <GitCompareArrows size={20} aria-hidden />
        <h3>{open ? `${open} conflict${open > 1 ? 's' : ''} to review` : 'Conflicts reviewed'}</h3>
      </div>
      <p className="muted small">
        Until you choose, the assistant shows both versions and says they disagree. It never picks one silently.
      </p>
      <ul className="list">
        {a.draft.conflicts.map((c) => (
          <ConflictCard key={c.id} a={a} c={c} />
        ))}
      </ul>
    </section>
  );
}
