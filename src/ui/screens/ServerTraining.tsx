import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, FileSearch, Layers3, Loader2, RefreshCw, ScanText, SearchCheck } from 'lucide-react';
import { ThinkingTool } from '@/components/ui/thinking-tool';
import { api } from '../../lib/api';
import { dispatch, flushRemote } from '../../domain/store';
import * as op from '../../domain/operations';
import { Button, Notice } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import { useProcessing } from './knowledge/useProcessing';

export function ServerTraining({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const processing = useProcessing(a.id);
  const started = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await flushRemote();
      await api(`/api/projects/${a.id}/train`, { method: 'POST' });
      await processing.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start processing.'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!processing.checked || started.current) return;
    started.current = true;
    if (!processing.indexed && !processing.jobs.some((j) => j.kind === 'index' && (j.status === 'running' || j.status === 'queued'))) void start();
  }, [processing.checked]);
  const running = busy || processing.jobs.some((j) => j.status === 'queued' || j.status === 'running');
  const ready = processing.indexed && !running;
  const latestIndex = processing.jobs.find((j) => j.kind === 'index');
  const visible = processing.jobs.filter((j, i, jobs) => j.kind === 'index' ? j.id === latestIndex?.id : !jobs.slice(0, i).some((other) => other.source_id === j.source_id));
  const count = a.draft.sources.reduce((n, s) => n + s.chunks.length, 0) + a.draft.faqs.filter((f) => f.approved).length;
  const ingestComplete = a.draft.sources.every((s) => s.status === 'ready');
  const stages = [
    { label: 'Read & parse', detail: 'Documents and structure', Icon: FileSearch, done: ingestComplete },
    { label: 'Read images', detail: 'OCR where needed', Icon: ScanText, done: ingestComplete },
    { label: 'Prepare passages', detail: 'Keep every source linked', Icon: Layers3, done: ingestComplete && count > 0 },
    { label: 'Build search', detail: 'Index your knowledge', Icon: SearchCheck, done: ready },
  ];

  return <div className="screen">
    <StepHeading step="training" n={stepNumber} title={ready ? 'Your assistant is ready to test.' : running ? 'Your knowledge team is working…' : 'Prepare your sources for answers.'}
      intro="Your sources become searchable knowledge, one careful step at a time. Follow the team's live progress below." />
    <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
      <div className="pipeline-stages">{stages.map(({ label, detail, Icon, done }, i) => <div className={`pipeline-stage ${done ? 'is-done' : ''}`} key={label}><span className="pipeline-stage-icon">{done ? <CheckCircle2 size={20} /> : <Icon size={20} />}</span><span><span className="pipeline-number">0{i+1}</span><strong>{label}</strong><span>{detail}</span></span></div>)}</div>
      <div className={`training-summary ${ready ? 'is-ready' : ''}`}><span className="live-dot" /><strong>{ready ? 'Everything is connected' : running ? 'Preparing your knowledge' : 'Ready when you are'}</strong><span>{a.draft.sources.length} {a.draft.sources.length === 1 ? 'source' : 'sources'}</span><span>{count} {count === 1 ? 'passage' : 'passages'}</span><span className="training-summary-note">{running ? 'Safe to leave this page' : ready ? 'Ready for your first question' : 'Prepare the index to continue'}</span></div>
      {(error || processing.error) && <Notice tone="danger">{error || processing.error}</Notice>}
      <div className="training-jobs card card-pad stack">
        <div className="training-jobs-heading"><h2>Agent activity</h2><span className="muted small">{running ? 'Live updates' : 'Latest run'}</span></div>
        {visible.length === 0 && <p className="muted">Starting the knowledge coordinator…</p>}
        {visible.map((job) => {
          const source = a.draft.sources.find((s) => s.id === job.source_id);
          const pending = job.status === 'running' || job.status === 'queued';
          return <div key={job.id} className="training-job stack" style={{ '--gap': '12px' } as React.CSSProperties}>
            <div className="spread"><strong>{job.kind === 'index' ? 'Search indexing' : source?.title || 'Document processing'}</strong>
              <span className={`pill ${job.status === 'complete' ? 'pill-ok' : job.status === 'failed' ? 'pill-danger' : 'pill-accent'}`}>
                {pending ? <Loader2 size={14} className="spin" /> : job.status === 'complete' ? <CheckCircle2 size={14} /> : null} {job.stage}
              </span></div>
            <progress aria-label={`${source?.title || 'Search indexing'} progress`} value={job.progress} max={100} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <span className="muted small">{job.events.at(-1)?.message || 'Waiting for the worker'}</span>
            {job.error && <Notice tone="danger">{job.error}</Notice>}
            <div className="job-thinking" aria-label="Processing activity"><ThinkingTool state={pending ? 'thinking' : 'thought'} content={job.events.length ? job.events.map((event) => `${new Date(event.at).toLocaleTimeString()} · ${event.agent}\n${event.message}`).join('\n\n') : 'Waiting for the knowledge coordinator to pick up this job.'} /></div>
            {job.status === 'failed' && job.source_id && <Button size="sm" onClick={async () => {
              try { await api(`/api/projects/${a.id}/sources/${job.source_id}/retry`, { method: 'POST' }); await processing.refresh(); }
              catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); }
            }}>Retry this source</Button>}
          </div>;
        })}
      </div>
      <p className="muted small">Images and scanned pages take longer because each needs OCR. The first indexing run downloads a local embedding model. You can leave this screen and return; jobs continue on the backend. This prepares source knowledge and does not retrain model weights.</p>
      <div><Button icon={<RefreshCw size={16} />} disabled={running} onClick={() => void start()}>{ready ? 'Rebuild search index' : 'Prepare / retry indexing'}</Button></div>
    </div>
    <div className="action-bar"><button className="back-link" onClick={onBack}><ChevronLeft size={18} /> Back</button>
      <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} disabled={!ready} onClick={async () => {
        dispatch((s) => op.markTrained(s, a.id));
        try { await flushRemote(); onNext(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
      }}>{nextLabel || 'Try & test'}</Button></div>
  </div>;
}
