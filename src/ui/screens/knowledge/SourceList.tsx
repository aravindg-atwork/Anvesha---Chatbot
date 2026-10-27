import { useRef, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Eye, Loader2, MoreHorizontal, RefreshCw, Replace, Settings2, Trash2 } from 'lucide-react';
import type { Assistant, Source } from '../../../domain/types';
import { dispatch } from '../../../domain/store';
import * as op from '../../../domain/operations';
import { formatLocator, isOutdated, supersededIds } from '../../../domain/knowledge';
import { ACCEPTED } from '../../../domain/ingest';
import { Button, Confirm, Field, Modal, formatDate, toast } from '../../components/ui';
import { canRetry, forget, replace, retry } from './processing';

export function StatusPill({ s }: { s: Source }) {
  if (s.status === 'reading')
    return (
      <span className="pill pill-accent" role="status">
        <Loader2 size={14} className="spin" aria-hidden /> Reading file
      </span>
    );
  if (s.status === 'attention')
    return (
      <span className="pill pill-danger">
        <AlertCircle size={14} aria-hidden /> Needs attention
      </span>
    );
  return (
    <span className="pill pill-ok">
      <CheckCircle2 size={14} aria-hidden /> Ready
    </span>
  );
}

function sizeLabel(n?: number) {
  if (!n) return '';
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export function PreviewModal({ s, onClose }: { s: Source; onClose: () => void }) {
  return (
    <Modal title={s.title} onClose={onClose} wide description="This is exactly what your assistant will read from this source.">
      <div className="stack">
        {s.extractionNote && <p className="notice small">{s.extractionNote}</p>}
        {s.chunks.length === 0 ? (
          <p className="muted">No readable text was found in this source.</p>
        ) : (
          <ol className="list" style={{ listStyle: 'none' }}>
            {s.chunks.map((c) => (
              <li key={c.id} className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                <span className="ref-label">{formatLocator(c.locator)}</span>
                <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Modal>
  );
}

function DetailsModal({ a, s, onClose }: { a: Assistant; s: Source; onClose: () => void }) {
  const [form, setForm] = useState({
    title: s.title,
    visibility: s.visibility,
    version: s.version ?? '',
    effectiveDate: s.effectiveDate ?? '',
    reviewBy: s.reviewBy ?? '',
    supersedes: s.supersedes ?? '',
  });
  const others = a.draft.sources.filter((x) => x.id !== s.id);
  const save = () => {
    dispatch((st) =>
      op.updateSource(st, a.id, s.id, {
        title: form.title.trim() || s.title,
        visibility: form.visibility,
        version: form.version.trim() || undefined,
        effectiveDate: form.effectiveDate || undefined,
        reviewBy: form.reviewBy || undefined,
        supersedes: form.supersedes || undefined,
      }),
    );
    toast('Source details saved to the draft.');
    onClose();
  };
  return (
    <Modal
      title="Source details"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <Field label="Title">{(id) => <input id={id} className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, '--gap': '10px' } as React.CSSProperties}>
          <legend className="field-label" style={{ marginBottom: 10 }}>
            Who may see this information?
          </legend>
          {(
            [
              ['internal', 'Internal only', 'Used only when the assistant is published for authorised users.'],
              ['public', 'Public', 'May also be used by a public assistant that anyone can open.'],
            ] as const
          ).map(([v, t, d]) => (
            <label key={v} className="check">
              <input type="radio" name="vis" checked={form.visibility === v} onChange={() => setForm({ ...form, visibility: v })} />
              <span>
                <strong>{t}</strong>
                <br />
                <span className="muted small">{d}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="split" style={{ gap: 16 }}>
          <Field label="Version" optional>
            {(id) => <input id={id} className="input" placeholder="e.g. 2025" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />}
          </Field>
          <Field label="Effective from" optional>
            {(id) => <input id={id} type="date" className="input" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} />}
          </Field>
        </div>
        <Field label="Review by" optional hint="After this date, Anvesha reminds you the source may be out of date.">
          {(id, d) => <input id={id} aria-describedby={d} type="date" className="input" value={form.reviewBy} onChange={(e) => setForm({ ...form, reviewBy: e.target.value })} />}
        </Field>
        <Field label="This replaces an older source" optional hint="The older source will no longer be used for answers.">
          {(id, d) => (
            <select id={id} aria-describedby={d} className="select" value={form.supersedes} onChange={(e) => setForm({ ...form, supersedes: e.target.value })}>
              <option value="">Doesn’t replace anything</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </Modal>
  );
}

function SourceRow({ a, s, replacedBy }: { a: Assistant; s: Source; replacedBy?: Source }) {
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const [details, setDetails] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const outdated = isOutdated(s.reviewBy);
  const isFile = s.origin !== 'written';

  return (
    <li className="source-row">
      <span className="file-badge" aria-hidden>
        {s.fileType === 'Written' ? 'TEXT' : s.fileType === 'Other' ? 'FILE' : s.fileType}
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="source-title">{s.title}</div>
        <div className="source-meta">
          <StatusPill s={s} />
          <span>{s.fileType === 'Written' ? 'Written information' : `${s.fileType === 'Other' ? 'Unsupported' : s.fileType} file${s.size ? ` · ${sizeLabel(s.size)}` : ''}`}</span>
          {s.status === 'ready' && <span>{s.chunks.length} passages</span>}
          <span>{s.visibility === 'public' ? 'Public' : 'Internal only'}</span>
          {s.version && <span>Version {s.version}</span>}
          {s.effectiveDate && <span>From {formatDate(s.effectiveDate)}</span>}
        </div>
        {s.status === 'attention' && s.attention && (
          <p className="small" style={{ color: 'var(--danger)', marginTop: 6 }}>
            {s.attention}
          </p>
        )}
        {replacedBy && (
          <p className="small muted" style={{ marginTop: 6 }}>
            Replaced by “{replacedBy.title}”. Not used for answers.
          </p>
        )}
        {outdated && (
          <p className="small row" style={{ color: 'var(--warn)', marginTop: 6, '--gap': '6px' } as React.CSSProperties}>
            <CalendarClock size={15} aria-hidden /> Review date passed ({formatDate(s.reviewBy)}). Check it’s still current.
          </p>
        )}
      </div>
      <div className="source-actions">
        {s.status === 'attention' && isFile && (
          canRetry(s.id) ? (
            <Button size="sm" icon={<RefreshCw size={15} />} onClick={() => retry(a.id, s.id)}>
              Try again
            </Button>
          ) : (
            <Button size="sm" icon={<Replace size={15} />} onClick={() => fileRef.current?.click()}>
              Replace file
            </Button>
          )
        )}
        {s.status === 'attention' && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmRemove(true)}>
            Remove
          </Button>
        )}
        {s.status === 'ready' && (
          <Button size="sm" variant="ghost" icon={<Eye size={16} />} onClick={() => setPreview(true)}>
            Preview
          </Button>
        )}
        <div
          style={{ position: 'relative' }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setMenu(false);
          }}
        >
          <button className="icon-btn" aria-label={`More actions for ${s.title}`} aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <MoreHorizontal size={20} />
          </button>
          {menu && (
            <div
              className="card"
              role="menu"
              style={{ position: 'absolute', right: 0, top: 48, zIndex: 15, padding: 6, minWidth: 210, display: 'flex', flexDirection: 'column' }}
              onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}
            >
              <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => (setMenu(false), setDetails(true))}>
                <Settings2 size={16} /> Details and version
              </button>
              {isFile && (
                <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => (setMenu(false), fileRef.current?.click())}>
                  <Replace size={16} /> Replace file
                </button>
              )}
              <button role="menuitem" className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: 'var(--danger)' }} onClick={() => (setMenu(false), setConfirmRemove(true))}>
                <Trash2 size={16} /> Remove
              </button>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) replace(a.id, s.id, f);
          }}
        />
      </div>
      {preview && <PreviewModal s={s} onClose={() => setPreview(false)} />}
      {details && <DetailsModal a={a} s={s} onClose={() => setDetails(false)} />}
      {confirmRemove && (
        <Confirm
          title="Remove this source?"
          body={
            <>
              “{s.title}” will no longer be used in the draft. The published version, if any, is not affected until you publish again.
            </>
          }
          confirmLabel="Remove"
          danger
          onConfirm={() => {
            forget(s.id);
            dispatch((st) => op.removeSource(st, a.id, s.id));
            toast('Source removed from the draft.');
          }}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </li>
  );
}

export function SourceList({ a }: { a: Assistant }) {
  const superseded = supersededIds(a.draft.sources);
  return (
    <ul className="source-list" aria-label="Sources">
      {a.draft.sources.map((s) => (
        <SourceRow key={s.id} a={a} s={s} replacedBy={superseded.has(s.id) ? a.draft.sources.find((x) => x.supersedes === s.id) : undefined} />
      ))}
    </ul>
  );
}
