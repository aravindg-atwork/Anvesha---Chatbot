import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft, FileSearch, RefreshCw, SearchCheck, Sparkles } from 'lucide-react';
import { ToolCallCard, ToolCallGroup } from '@/components/ui/tool-call-card';
import { api } from '../../lib/api';
import { dispatch, flushRemote } from '../../domain/store';
import * as op from '../../domain/operations';
import { Button, Notice } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import { PreparationCanvas, PreparationStages, PreparedQuestions, SourcePreparationList, useStudioEntrance } from './knowledge/KnowledgeCanvas';
import { retry } from './knowledge/processing';
import './knowledge/studio.css';
import { useProcessing } from './knowledge/useProcessing';

export function ServerTraining({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const processing = useProcessing(a.id);
  const studioRef = useStudioEntrance();
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
    if (!processing.indexed && !processing.jobs.some((j) => (j.kind === 'index' || j.kind === 'drive_sync') && (j.status === 'running' || j.status === 'queued'))) void start();
  }, [processing.checked]);
  const running = busy || processing.jobs.some((j) => j.status === 'queued' || j.status === 'running');
  const ready = processing.indexed && !running;
  const latestIndex = processing.jobs.find((j) => j.kind === 'index');
  const visible = processing.jobs.filter((j, i, jobs) => j.kind === 'index' ? j.id === latestIndex?.id : !jobs.slice(0, i).some((other) => other.kind === j.kind && other.source_id === j.source_id));
  const count = a.draft.sources.reduce((n, s) => n + s.chunks.length, 0) + a.draft.faqs.filter((f) => f.approved).length;
  const ingestComplete = a.draft.sources.every((s) => s.status === 'ready');
  const currentJob = processing.jobs.find(job => job.status === 'running');
  const activeStep = ingestComplete && count > 0 ? 4 : /OCR|image/i.test(currentJob?.stage ?? '') ? 1 : /catalog/i.test(currentJob?.stage ?? '') ? 3 : /curat|passage/i.test(currentJob?.stage ?? '') ? 2 : 0;
  const failures = a.draft.sources.filter(source => source.status === 'attention');

  return <div className="screen training-studio" ref={studioRef}>
    <header className="knowledge-studio-hero" data-studio-enter><div><span className="studio-section-kicker"><span>02</span> The preparation room</span><StepHeading step="training" n={stepNumber} title={ready ? 'Your assistant is ready to test.' : running ? 'Your knowledge tools are working.' : 'Prepare your sources for answers.'} intro="Watch your information become something you can ask a good question." /></div><span className={`preparation-state-badge ${ready ? 'is-ready' : ''}`}>{ready ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}{ready ? 'Ready to explore' : running ? 'Working in the background' : 'Ready when you are'}</span></header>
    <div className="preparation-overview" data-studio-enter><PreparationCanvas running={running} ready={ready} sources={a.draft.sources.length} passages={count} task={currentJob ? currentJob.stage : undefined} progress={currentJob?.progress} /><PreparationStages ready={ready} running={running} activeStep={activeStep} /></div>
    {(error || processing.error) && <Notice tone="danger">{error || processing.error}</Notice>}
    <div className="preparation-quality-strip"><span><i className={failures.length ? 'has-attention' : ''} />{failures.length ? `${failures.length} sources need attention` : 'Every source has a clear status'}</span><span>{running ? 'Safe to leave. Jobs continue on the backend.' : ready ? 'Open a source below, or continue to try your assistant.' : 'Use preparation controls to build your searchable library.'}</span></div>
    {ready && <PreparedQuestions a={a} />}
    <SourcePreparationList a={a} onRetry={async source => { if (!await retry(a.id, source.id)) setError('Retry was not available. Return to Upload to replace this file.'); else await processing.refresh(); }} />
    <div className="preparation-activity-layout">
      <div className="training-jobs card card-pad stack">
        <div className="training-jobs-heading"><h2>Processing tools</h2><span className="muted small">{running ? 'Live updates' : 'Latest run'}</span></div>
        {visible.length === 0 && <p className="muted">Starting the knowledge coordinator…</p>}
        {visible.filter((job) => job.status === 'queued').map((job) => <div className="training-job spread" key={job.id}><strong>{job.kind === 'drive_sync' ? 'Google Drive sync' : job.kind === 'index' ? 'Search indexing' : a.draft.sources.find((s) => s.id === job.source_id)?.title || 'Document processing'}</strong><span className="muted small">Queued · Waiting for the worker</span></div>)}
        {visible.some((job) => job.status !== 'queued') && <ToolCallGroup defaultOpen runningLabel="Preparing your knowledge…">{visible.filter((job) => job.status !== 'queued').map((job) => {
          const source = a.draft.sources.find((s) => s.id === job.source_id);
          const first = job.events[0]?.at;
          const last = job.events.at(-1)?.at;
          return <ToolCallCard key={job.id} name={job.kind === 'drive_sync' ? 'sync_google_drive' : job.kind === 'index' ? 'index_knowledge' : 'prepare_source'} summary={job.kind === 'index' ? `Search indexing · ${job.stage}` : `${job.kind === 'drive_sync' ? 'Google Drive sync' : source?.title || 'Document processing'} · ${job.stage}`} icon={job.kind === 'index' ? <SearchCheck /> : <FileSearch />} status={job.status === 'running' ? 'running' : job.status === 'complete' ? 'success' : 'error'} startedAt={first ? Date.parse(first) : undefined} duration={first && last ? Math.max(0, Date.parse(last) - Date.parse(first)) : undefined} args={job.kind === 'drive_sync' ? { project: a.draft.name, action: 'Fetch selected Google Drive folders' } : job.kind === 'index' ? { project: a.draft.name, sources: a.draft.sources.length } : { source: source?.title || 'Removed source', format: source?.fileType }} result={{ stage: job.stage, progress: job.progress, activity: job.events }} error={job.error || (job.status === 'cancelled' ? 'This source was removed.' : undefined)} onRetry={job.status === 'failed' ? async () => {
              if (job.kind === 'drive_sync') {
                try { await api(`/api/drive/sync/${a.id}`, { method: 'POST' }); await processing.refresh(); }
                catch (e) { setError(e instanceof Error ? e.message : 'Sync retry failed.'); }
                return;
              }
                if (!job.source_id) { await start(); return; }
              try { await api(`/api/projects/${a.id}/sources/${job.source_id}/retry`, { method: 'POST' }); await processing.refresh(); }
              catch (e) { setError(e instanceof Error ? e.message : 'Retry failed.'); }
            } : undefined} />;
        })}</ToolCallGroup>}
      </div>
      <aside className="preparation-insight"><span className="studio-section-kicker">Good answers have roots</span><h2>Every passage.<br />A source to follow.</h2><p>Documents are read, passages are linked, and search brings the relevant pieces together.</p><div><SearchCheck size={18} /><span>Local search indexing</span></div><div><FileSearch size={18} /><span>Original source references</span></div><p className="preparation-insight-note">Images and scans can take longer. First-time indexing may download the local embedding model.</p><Button size="sm" icon={<RefreshCw size={15} />} disabled={running} onClick={() => void start()}>{ready ? 'Rebuild search index' : 'Prepare / retry indexing'}</Button></aside>
    </div>
    <div className="action-bar knowledge-studio-footer"><button className="back-link" onClick={onBack}><ChevronLeft size={18} /> Back</button><span className="knowledge-footer-state"><i />{ready ? 'Your next question is a good place to start.' : 'A little preparation goes a long way.'}</span><Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} disabled={!ready} onClick={async () => {
      dispatch(st => op.markTrained(st, a.id));
      try { await flushRemote(); onNext(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    }}>{nextLabel || 'Try & test'}</Button></div>
  </div>;
}
