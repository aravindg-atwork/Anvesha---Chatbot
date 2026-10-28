import { useState } from 'react';
import { ArrowRight, ChevronLeft, FileUp, MessagesSquare, PenLine, Sparkles } from 'lucide-react';
import type { Source, Visibility } from '../../domain/types';
import { dispatch, useAppState, isRemoteSession } from '../../domain/store';
import * as op from '../../domain/operations';
import { chunkPlainText } from '../../domain/ingest/txt';
import { ACCEPTED, fileTypeOf } from '../../domain/ingest';
import { uid, nowIso } from '../../lib/id';
import { Button, Field, FilePicker, Modal, Notice, toast } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import { SourceList } from './knowledge/SourceList';
import { FaqManager, useFaqCsvImport } from './knowledge/FaqManager';
import { addFile } from './knowledge/processing';
import { useProcessing } from './knowledge/useProcessing';

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
            Add to project
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

export function KnowledgeStep({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const processing = useProcessing(a.id);
  const d = a.draft;
  const isDemo = useAppState((s) => s.session?.kind === 'demo');
  const [writing, setWriting] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [over, setOver] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const csv = useFaqCsvImport(a);

  const handleFiles = (list: FileList | File[]) => {
    setBlocked(null);
    for (const f of Array.from(list)) {
      // CSVs are question-and-answer imports, with their own preview.
      if (fileTypeOf(f.name) === 'CSV') csv.start(f);
      else addFile(a.id, f);
    }
  };

  const ready = d.sources.filter((s) => s.status === 'ready').length + d.faqs.filter((f) => f.approved).length;
  const reading = d.sources.some((s) => s.status === 'reading');
  const hasSample = d.sources.some((s) => s.sampleKey);

  return (
    <div className="screen">
      <StepHeading step="upload" n={stepNumber} title="Give your assistant the information it needs." intro="Upload documents, add questions and answers, or write it in your own words." />

      <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
        <div className="upload-grid">
          {/* The whole card is the drop target and the button always opens the file picker. */}
          <div
            className={`dropzone upload-main ${over ? 'over' : ''}`}
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
            <span className="choice-icon" style={{ width: 52, height: 52 }}>
              <FileUp size={26} />
            </span>
            <div className="stack" style={{ '--gap': '4px', alignItems: 'center' } as React.CSSProperties}>
              <strong style={{ fontSize: '1.15rem' }}>Upload files</strong>
              <span className="muted small">Drag files here, or choose them from your computer</span>
            </div>
            <FilePicker variant="primary" accept={ACCEPTED} multiple onFiles={handleFiles} testId="file-input">
              Choose files
            </FilePicker>
            <span className="faint small">PDF, Word, text, CSV, PNG, JPG, WEBP or TIFF · up to 15 MB. Images and scans use OCR.</span>
          </div>
          <div className="upload-side">
            <button className="choice" aria-expanded={faqOpen} onClick={() => setFaqOpen(!faqOpen)}>
              <span className="choice-icon">
                <MessagesSquare size={22} />
              </span>
              <span>
                <span className="choice-title">Add questions and answers</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  {d.faqs.length ? `${d.faqs.length} so far · type them or import a CSV` : 'Type them, or import a CSV'}
                </span>
              </span>
            </button>
            <button className="choice" onClick={() => setWriting(true)}>
              <span className="choice-icon">
                <PenLine size={22} />
              </span>
              <span>
                <span className="choice-title">Write information</span>
                <span className="choice-desc" style={{ display: 'block' }}>
                  Paste or type it in
                </span>
              </span>
            </button>
            {isDemo && !hasSample && (
              <button
                className="choice choice-demo"
                onClick={() => {
                  dispatch((s) => op.addSampleDocuments(s, a.id));
                  toast('VayuTech sample documents added.');
                }}
              >
                <span className="choice-icon">
                  <Sparkles size={22} />
                </span>
                <span>
                  <span className="choice-title">Use VayuTech sample documents</span>
                  <span className="choice-desc" style={{ display: 'block' }}>
                    Demo only · fictional leave policy, benefits and FAQs
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        {faqOpen && (
          <div className="card card-pad">
            <FaqManager a={a} />
          </div>
        )}

        {d.sources.length > 0 ? (
          <section className="stack" aria-label="Your information">
            <h2 style={{ fontSize: '1.35rem' }}>Your information</h2>
            <SourceList a={a} />
          </section>
        ) : (
          <div className="panel muted center-text">Nothing added yet. Your files will appear here with their status.</div>
        )}

        {!faqOpen && d.faqs.length > 0 && (
          <div className="panel spread">
            <span>
              <strong>Questions and answers</strong> · {d.faqs.length} entr{d.faqs.length === 1 ? 'y' : 'ies'}
            </span>
            <Button size="sm" onClick={() => setFaqOpen(true)}>
              Manage
            </Button>
          </div>
        )}

        {processing.error && <Notice tone="danger">{processing.error}</Notice>}
        {blocked && <Notice tone="warn">{blocked}</Notice>}
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> Projects
        </button>
        <Button
          variant="primary"
          size="lg"
          iconEnd={<ArrowRight size={20} />}
          onClick={() => {
            if (isRemoteSession() && d.sources.length) { onNext(); return; }
            if (reading) return setBlocked('Please wait until all files have been read.');
            if (!ready) return setBlocked('Add at least one file that is ready, or a question and answer, to continue.');
            onNext();
          }}
        >
          {nextLabel}
        </Button>
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
            toast('Information added.');
          }}
        />
      )}
      {csv.modal}
    </div>
  );
}
