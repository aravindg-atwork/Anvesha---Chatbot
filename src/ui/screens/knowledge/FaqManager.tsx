import { useState } from 'react';
import { FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Assistant, FaqEntry, Visibility } from '../../../domain/types';
import { dispatch } from '../../../domain/store';
import * as op from '../../../domain/operations';
import { parseFaqCsv, type FaqImportResult } from '../../../domain/ingest/csv';
import { Button, Confirm, Field, FilePicker, Modal, Notice, toast } from '../../components/ui';

export function FaqEditor({
  initial,
  title,
  onSave,
  onClose,
  requireApproval,
  note,
}: {
  initial: { question: string; answer: string; visibility: Visibility };
  title: string;
  onSave: (v: { question: string; answer: string; visibility: Visibility }) => void;
  onClose: () => void;
  requireApproval?: boolean;
  note?: string;
}) {
  const [v, setV] = useState(initial);
  const [approved, setApproved] = useState(!requireApproval);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      title={title}
      onClose={onClose}
      description={note}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!v.question.trim() || !v.answer.trim()) return setErr('Write both a question and an answer.');
              if (!approved) return setErr('Confirm that this answer is approved before saving.');
              onSave(v);
              onClose();
            }}
          >
            Save to draft
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <Field label="Question">{(id) => <input id={id} className="input" value={v.question} onChange={(e) => setV({ ...v, question: e.target.value })} />}</Field>
        <Field label="Answer" hint="Write the answer exactly as people should receive it.">
          {(id, d) => <textarea id={id} aria-describedby={d} className="textarea" rows={5} value={v.answer} onChange={(e) => setV({ ...v, answer: e.target.value })} />}
        </Field>
        <label className="check">
          <input type="checkbox" checked={v.visibility === 'public'} onChange={(e) => setV({ ...v, visibility: e.target.checked ? 'public' : 'internal' })} />
          <span>
            Public information
            <br />
            <span className="muted small">Allow a public assistant to use this answer.</span>
          </span>
        </label>
        {requireApproval && (
          <label className="check">
            <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            <span>
              <strong>I approve this answer.</strong>
              <br />
              <span className="muted small">It will be used in the draft only. People see it after you publish.</span>
            </span>
          </label>
        )}
        {err && <p className="field-error">{err}</p>}
      </div>
    </Modal>
  );
}

function ImportPreview({ result, onImport, onClose }: { result: FaqImportResult; onImport: () => void; onClose: () => void }) {
  const good = result.rows.filter((r) => !r.problem);
  return (
    <Modal
      title="Check before importing"
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {result.ok && (
            <Button variant="primary" disabled={!good.length} onClick={onImport}>
              Import {good.length} question{good.length === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      {!result.ok ? (
        <Notice tone="danger">{result.error}</Notice>
      ) : (
        <div className="stack">
          {result.rows.length > good.length && (
            <Notice tone="warn">
              {result.rows.length - good.length} row{result.rows.length - good.length === 1 ? '' : 's'} will be skipped. Fix them in the file and import again if needed.
            </Notice>
          )}
          <ul className="list">
            {result.rows.map((r) => (
              <li key={r.line} style={r.problem ? { background: 'var(--danger-soft)' } : undefined}>
                <div className="spread" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <span className="faint small">Row {r.line}</span>
                    <p>
                      <strong>{r.question || '—'}</strong>
                    </p>
                    <p className="muted">{r.answer || '—'}</p>
                  </div>
                  {r.problem ? <span className="pill pill-danger">{r.problem}</span> : <span className="pill pill-ok">Ready</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

export function useFaqCsvImport(a: Assistant) {
  const [result, setResult] = useState<FaqImportResult | null>(null);
  const start = async (file: File) => {
    if (file.size === 0) return setResult({ ok: false, error: 'This file is empty.', rows: [] });
    const text = await file.text();
    setResult(parseFaqCsv(text, a.draft.faqs.map((f) => f.question)));
  };
  const modal = result && (
    <ImportPreview
      result={result}
      onClose={() => setResult(null)}
      onImport={() => {
        const rows = result.rows.filter((r) => !r.problem);
        dispatch((s) => op.importFaqs(s, a.id, rows));
        toast(`${rows.length} question${rows.length === 1 ? '' : 's'} added to the draft.`);
        setResult(null);
      }}
    />
  );
  return { start, modal };
}

export function FaqManager({ a }: { a: Assistant }) {
  const [editing, setEditing] = useState<FaqEntry | 'new' | null>(null);
  const [removing, setRemoving] = useState<FaqEntry | null>(null);
  const csv = useFaqCsvImport(a);

  return (
    <section className="stack" aria-label="Questions and answers">
      <div className="spread">
        <h3>Questions and answers</h3>
        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
          <FilePicker size="sm" icon={<FileUp size={16} />} accept=".csv,text/csv" onFiles={(f) => csv.start(f[0])}>
            Import CSV
          </FilePicker>
          <Button size="sm" variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
            Add question
          </Button>
        </div>
      </div>
      <p className="muted small">CSV files need two columns named “Question” and “Answer”. You’ll see a preview before anything is added.</p>
      {a.draft.faqs.length === 0 ? (
        <div className="panel muted">No questions yet. Add the questions people ask most often.</div>
      ) : (
        <ul className="list">
          {a.draft.faqs.map((f) => (
            <li key={f.id} className="spread" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <span className="faint small mono">{f.code}</span>
                  {!f.approved && <span className="pill pill-warn">Not approved</span>}
                  <span className="faint small">{f.visibility === 'public' ? 'Public' : 'Internal only'}</span>
                </div>
                <p style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{f.question}</p>
                <p className="muted" style={{ overflowWrap: 'anywhere' }}>
                  {f.answer || <em>No answer yet</em>}
                </p>
              </div>
              <div className="row" style={{ '--gap': '2px', flexWrap: 'nowrap' } as React.CSSProperties}>
                <button className="icon-btn" aria-label={`Edit ${f.code}`} onClick={() => setEditing(f)}>
                  <Pencil size={17} />
                </button>
                <button className="icon-btn" aria-label={`Delete ${f.code}`} onClick={() => setRemoving(f)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {csv.modal}
      {editing && (
        <FaqEditor
          title={editing === 'new' ? 'Add a question' : `Edit ${editing.code}`}
          initial={editing === 'new' ? { question: '', answer: '', visibility: 'internal' } : editing}
          requireApproval={editing !== 'new' && !editing.approved}
          onClose={() => setEditing(null)}
          onSave={(v) => {
            if (editing === 'new') dispatch((s) => op.addFaq(s, a.id, v));
            else dispatch((s) => op.updateFaq(s, a.id, editing.id, { ...v, approved: true }));
            toast('Saved to the draft.');
          }}
        />
      )}
      {removing && (
        <Confirm
          title={`Delete ${removing.code}?`}
          body={`“${removing.question}” will be removed from the draft.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => dispatch((s) => op.removeFaq(s, a.id, removing.id))}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  );
}
