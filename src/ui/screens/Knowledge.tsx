import { useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, FilePlus2, MessagesSquare, PenLine, Upload } from 'lucide-react';
import type { Source, Visibility } from '../../domain/types';
import { dispatch } from '../../domain/store';
import * as op from '../../domain/operations';
import { chunkPlainText } from '../../domain/ingest/txt';
import { ACCEPTED, fileTypeOf } from '../../domain/ingest';
import { uid, nowIso } from '../../lib/id';
import { Button, Field, Modal, Notice, toast } from '../components/ui';
import type { StepProps } from '../App';
import { SourceList } from './knowledge/SourceList';
import { FaqManager, useFaqCsvImport } from './knowledge/FaqManager';
import { ConflictList } from './knowledge/Conflicts';
import { addFile } from './knowledge/processing';

type Panel = 'upload' | 'faq' | null;

function WriteModal({ onSave, onClose }: { onSave: (title: string, text: string, vis: Visibility) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [pub, setPub] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      title="Write information"
      description="Paste or type information. Short headings on their own line help the assistant point to the right part."
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!title.trim()) return setErr('Give this information a title.');
              if (!text.trim()) return setErr('Write some information first.');
              onSave(title.trim(), text, pub ? 'public' : 'internal');
              onClose();
            }}
          >
            Add to knowledge
          </Button>
        </>
      }
    >
      <div className="stack" style={{ '--gap': '18px' } as React.CSSProperties}>
        <Field label="Title">{(id) => <input id={id} className="input" placeholder="For example, Office opening hours" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Information">
          {(id) => <textarea id={id} className="textarea" rows={12} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 280 }} />}
        </Field>
        <label className="check">
          <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} />
          <span>
            Public information
            <br />
            <span className="muted small">Allow a public assistant to use it. Leave unticked for internal information.</span>
          </span>
        </label>
        {err && <p className="field-error">{err}</p>}
      </div>
    </Modal>
  );
}

export function KnowledgeStep({ assistant: a, mode, onNext, onBack }: StepProps) {
  const d = a.draft;
  const [panel, setPanel] = useState<Panel>(d.sources.length || d.faqs.length ? null : 'upload');
  const [writing, setWriting] = useState(false);
  const [over, setOver] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csv = useFaqCsvImport(a);

  const handleFiles = (list: FileList | File[]) => {
    setBlocked(null);
    for (const f of Array.from(list)) {
      // CSVs are question-and-answer imports, with their own preview.
      if (fileTypeOf(f.name) === 'CSV') {
        csv.start(f);
        setPanel('faq');
      } else addFile(a.id, f);
    }
  };

  const ready = d.sources.filter((s) => s.status === 'ready').length + d.faqs.filter((f) => f.approved).length;
  const reading = d.sources.some((s) => s.status === 'reading');

  const options = [
    { id: 'upload' as const, icon: <Upload size={22} />, t: 'Upload files', desc: 'PDF, Word or text files' },
    { id: 'faq' as const, icon: <MessagesSquare size={22} />, t: 'Add questions and answers', desc: 'Type them, or import a CSV' },
    { id: 'write' as const, icon: <PenLine size={22} />, t: 'Write information', desc: 'Paste or type it in' },
  ];

  return (
    <div className="screen">
      <div className="screen-head">
        {mode === 'setup' && <span className="eyebrow">Step 2 of 5</span>}
        <h1>Give your assistant the information it needs.</h1>
      </div>

      <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
        <div className="add-options">
          {options.map((o) => (
            <button
              key={o.id}
              className="choice"
              aria-pressed={panel === o.id}
              onClick={() => {
                if (o.id === 'write') setWriting(true);
                else setPanel(panel === o.id ? null : o.id);
              }}
            >
              <span className="choice-icon">{o.icon}</span>
              <span>
                <span className="choice-title">{o.t}</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {o.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        {panel === 'upload' && (
          <div
            className={`dropzone ${over ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <div className="stack" style={{ alignItems: 'center', '--gap': '12px' } as React.CSSProperties}>
              <FilePlus2 size={30} aria-hidden style={{ color: 'var(--accent)' }} />
              <p style={{ fontSize: '1.1rem' }}>Drag files here, or</p>
              <Button variant="primary" onClick={() => fileRef.current?.click()}>
                Choose files
              </Button>
              <p className="faint small">PDF, Word (.docx), text (.txt) and question-and-answer CSV · up to 15 MB each. Scanned pages can’t be read yet.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPTED}
              hidden
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        )}

        {panel === 'faq' && (
          <div className="card card-pad">
            <FaqManager a={a} />
          </div>
        )}

        {d.sources.length > 0 && (
          <section className="stack" aria-label="Your information">
            <h3>Your information</h3>
            <SourceList a={a} />
          </section>
        )}

        {panel !== 'faq' && d.faqs.length > 0 && (
          <div className="panel spread">
            <span>
              <strong>Questions and answers</strong> · {d.faqs.length} entr{d.faqs.length === 1 ? 'y' : 'ies'}
            </span>
            <Button size="sm" onClick={() => setPanel('faq')}>
              Manage
            </Button>
          </div>
        )}

        <ConflictList a={a} />

        {blocked && <Notice tone="warn">{blocked}</Notice>}
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> {mode === 'setup' ? 'Back' : 'Done'}
        </button>
        {mode === 'setup' ? (
          <Button
            variant="primary"
            size="lg"
            iconEnd={<ArrowRight size={20} />}
            onClick={() => {
              if (reading) return setBlocked('Please wait until all files have been read.');
              if (!ready) return setBlocked('Add at least one source that is ready, or a question and answer, to continue.');
              onNext();
            }}
          >
            Continue
          </Button>
        ) : (
          <span className="faint small">Changes are saved to your draft. Publish to make them live.</span>
        )}
      </div>

      {writing && (
        <WriteModal
          onClose={() => setWriting(false)}
          onSave={(title, text, visibility) => {
            const id = uid('src');
            const chunks = chunkPlainText(text, id);
            const s: Source = {
              id,
              title,
              fileType: 'Written',
              status: chunks.length ? 'ready' : 'attention',
              attention: chunks.length ? undefined : 'No readable text.',
              extractionNote: 'Written in Anvesha. References use headings or paragraph positions.',
              chunks,
              visibility,
              origin: 'written',
              addedAt: nowIso(),
            };
            dispatch((st) => op.addSource(st, a.id, s));
            toast('Information added to the draft.');
          }}
        />
      )}
      {csv.modal}
    </div>
  );
}
