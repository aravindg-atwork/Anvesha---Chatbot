import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ArrowUpRight, Check, Eye, FileSearch, FileText, Layers3, MessageSquareText, RefreshCw, ScanText, SearchCheck, ShieldCheck, Sparkles, Tags } from 'lucide-react';
import type { Assistant, Source } from '../../../domain/types';
import { Button } from '../../components/ui';
import { PreviewModal, StatusPill } from './SourceList';
import { navigate } from '../../router';
import { projectPath } from '../../App';

export function useStudioEntrance() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const ctx = gsap.context(() => {
        gsap.from('[data-studio-enter]', { y: 10, duration: .42, stagger: .055, ease: 'power3.out', clearProps: 'transform' });
      }, ref);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, []);
  return ref;
}

export function IntakeArt() {
  return <div className="intake-paper-scene" aria-hidden="true"><div className="intake-paper intake-paper-back"><span /><span /><span /></div><div className="intake-paper intake-paper-mid"><span /><span /><span /></div><div className="intake-paper intake-paper-front"><FileText size={30} strokeWidth={1.3} /><span /><span /><i><ArrowUpRight size={16} /></i></div><span className="intake-paper-orbit"><Sparkles size={14} /></span></div>;
}

export function ReadinessBadge({ total, ready }: { total: number; ready: number }) {
  const fraction = total ? ready / total : 0;
  return <div className="intake-readiness" aria-label={`${ready} of ${total} sources ready`}><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" /><circle className="intake-readiness-fill" cx="24" cy="24" r="19" strokeDasharray={`${fraction * 119.4} 119.4`} /></svg><div><strong>{total ? `${ready}/${total} ready` : 'A fresh beginning'}</strong><span>{total ? 'Your sources, taking shape' : 'Your next answer starts here'}</span></div></div>;
}

export function PreparationCanvas({ running, ready, sources, passages, task, progress, demo = false }: {
  running: boolean; ready: boolean; sources: number; passages: number; task?: string; progress?: number; demo?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const uid = useId().replace(/:/g, '');
  useEffect(() => {
    const root = ref.current;
    if (!root || !running) return;
    let visible = false;
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const pulse = gsap.to(root.querySelectorAll('.prep-beam-pulse'), { strokeDashoffset: -480, duration: 3, repeat: -1, ease: 'none', paused: true });
      const update = () => { if (visible && !document.hidden) pulse.play(); else pulse.pause(); };
      const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
      observer.observe(root); document.addEventListener('visibilitychange', update);
      return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); pulse.kill(); };
    });
    return () => media.revert();
  }, [running]);
  return <div ref={ref} className={`preparation-canvas ${ready ? 'is-ready' : ''}`} data-running={running || undefined}>
    <div className="preparation-canvas-head"><span><i />{demo ? 'Demo preparation' : running ? 'Live preparation' : ready ? 'Preparation complete' : 'Knowledge preparation'}</span><span><ShieldCheck size={14} /> Sources stay traceable</span></div>
    <div className="preparation-canvas-title"><h2>{ready ? 'Ready for a good question.' : running ? 'Connecting the knowledge.' : 'From your files to clarity.'}</h2><p>{ready ? 'Your passages are searchable and linked to their sources.' : 'A clear path from original documents to grounded answers.'}</p></div>
    <svg className="prep-diagram" viewBox="0 0 620 240" aria-hidden="true">
      <defs><linearGradient id={`prep-paper-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#dde3e8" stopOpacity=".6" /></linearGradient><linearGradient id={`prep-hub-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffffff" stopOpacity=".15" /><stop offset="1" stopColor="#ffffff" stopOpacity=".03" /></linearGradient></defs>
      <g className="prep-rail"><path d="M136 118H196Q226 118 245 118H260" /><path d="M360 118H414Q434 118 454 118H486" /></g>
      {running && <g className="prep-moving"><path className="prep-beam-pulse" d="M136 118H260" /><path className="prep-beam-pulse" d="M360 118H486" /></g>}
      <g transform="translate(66 63) rotate(-9 43 57)"><rect x="-13" y="-8" width="83" height="107" rx="9" fill="#ffffff12" stroke="#ffffff38" /><rect x="-5" y="-3" width="83" height="107" rx="9" fill="#ffffff20" stroke="#ffffff52" /><rect width="83" height="107" rx="9" fill={`url(#prep-paper-${uid})`} stroke="#fff" /><path d="M20 26H51M20 38H63M20 50H58M20 62H48" stroke="#3a0f3466" strokeWidth="3" strokeLinecap="round" /><rect x="18" y="77" width="30" height="10" rx="4" fill="#eaaa0099" /></g>
      <circle cx="310" cy="118" r="72" fill="none" stroke="#ffffff14" /><circle cx="310" cy="118" r="58" fill="none" stroke="#eaaa004d" strokeDasharray="2 7" />
      <rect x="267" y="75" width="86" height="86" rx="25" fill={`url(#prep-hub-${uid})`} stroke="#ffffff50" /><g transform="translate(279 87) scale(1.55)"><path d="M11 29a7 7 0 0 1-2-13 9 9 0 0 1 17-3 8 8 0 0 1 4 15c-4 5-7 2-10 3-4 2-7 1-9-2Z" fill="#f3f5f7" /><ellipse cx="19" cy="27" rx="8" ry="3" fill="#eaaa00" opacity=".24" /><rect x="15" y="17" width="4" height="8" rx="2" fill="#3a0f34" /><rect x="22" y="17" width="4" height="8" rx="2" fill="#3a0f34" /></g>
      <g transform="translate(484 76)"><rect x="8" y="-5" width="80" height="94" rx="10" fill="#ffffff12" stroke="#ffffff26" /><rect width="80" height="94" rx="10" fill="#ffffff14" stroke="#ffffff70" /><rect x="15" y="18" width="46" height="11" rx="4" fill="#eaaa004d" /><path d="M15 41H60M15 53H55M15 65H42" stroke="#dde3e8" strokeWidth="2.5" strokeLinecap="round" /></g>
      <g fill="#e0d6df" fontSize="12" textAnchor="middle"><text x="108" y="209">Original sources</text><text x="310" y="209">Anvesha</text><text x="525" y="209">Linked passages</text></g>
    </svg>
    <div className="preparation-canvas-foot"><div><FileText size={16} /><strong>{sources}</strong><span>sources</span></div><div><Layers3 size={16} /><strong>{passages}</strong><span>passages prepared</span></div><span className="prep-ready-mark">{ready ? <><Check size={14} /> Search ready</> : <><Sparkles size={14} /> {demo ? 'Browser demo' : 'Source-grounded'}</>}</span></div>
    {task && <div className="prep-current-task"><span>{task}</span>{typeof progress === 'number' && <strong>{Math.max(0, Math.min(100, Math.round(progress)))}% of this task</strong>}</div>}
  </div>;
}

const PREPARATION_STEPS = [
  { label: 'Read & parse', detail: 'Find the structure in your files', Icon: FileSearch },
  { label: 'Read images', detail: 'OCR for images and scanned pages', Icon: ScanText },
  { label: 'Prepare passages', detail: 'Keep every passage linked', Icon: Layers3 },
  { label: 'Tag & label', detail: 'Suggest labels and questions', Icon: Tags },
  { label: 'Build search', detail: 'Make the knowledge retrievable', Icon: SearchCheck },
];

export function PreparationStages({ ready, running, activeStep }: { ready: boolean; running: boolean; activeStep: number }) {
  return <section className="preparation-stage-panel" aria-label="Preparation stages"><span className="studio-section-kicker">Every step, accounted for</span><h2>A little preparation.<br />A lot more clarity.</h2><ol>{PREPARATION_STEPS.map(({ label, detail, Icon }, i) => {
    const done = ready || i < activeStep, active = !ready && running && i === activeStep;
    return <li className={done ? 'is-done' : active ? 'is-active' : ''} key={label}><span className="preparation-stage-icon">{done ? <Check size={17} /> : <Icon size={17} />}</span><div><strong>{label}</strong><p>{detail}</p><small>{done ? 'Complete' : active ? 'In progress' : 'Up next'}</small></div><span className="preparation-stage-number">0{i + 1}</span></li>;
  })}</ol><p className="preparation-stage-note"><ShieldCheck size={15} /> Preparing retrieval knowledge, not changing model weights.</p></section>;
}

export function SourcePreparationList({ a, onRetry }: { a: Assistant; onRetry?: (source: Source) => void }) {
  const [filter, setFilter] = useState('all');
  const [preview, setPreview] = useState<Source | null>(null);
  const sources = a.draft.sources.filter(source => filter === 'all' || source.status === filter);
  return <section className="preparation-source-panel" aria-label="Source preparation"><div className="knowledge-library-heading"><div><span className="studio-section-kicker">A place for every source</span><h2>Your source queue <span>{a.draft.sources.length}</span></h2></div><select className="select" aria-label="Filter preparation sources" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All sources</option><option value="reading">Processing</option><option value="ready">Ready</option><option value="attention">Needs attention</option></select></div><div className="preparation-source-list">{sources.length ? sources.map(source => <div className="preparation-source-row" key={source.id}><span className="preparation-source-file"><FileText size={20} /></span><div className="preparation-source-name"><strong>{source.title}</strong><small>{source.fileType} / {source.status === 'ready' ? `${source.chunks.length} ${source.chunks.length === 1 ? 'passage' : 'passages'}` : source.status === 'reading' ? 'Processing on the backend' : source.attention || 'Review this file'}</small></div><StatusPill s={source} />{source.status === 'ready' && <Button variant="ghost" size="sm" icon={<Eye size={15} />} onClick={() => setPreview(source)}>Preview</Button>}{source.status === 'attention' && onRetry && <Button size="sm" icon={<RefreshCw size={15} />} onClick={() => onRetry(source)}>Retry</Button>}</div>) : <p className="preparation-no-sources">{a.draft.sources.length ? 'No sources match this status.' : 'Sources will appear here as they arrive. Approved Q&A also contributes to your knowledge.'}</p>}</div>{preview && <PreviewModal s={preview} onClose={() => setPreview(null)} />}</section>;
}

export function PreparedQuestions({ a }: { a: Assistant }) {
  const superseded = new Set(a.draft.sources.map(source => source.supersedes).filter(Boolean));
  const available = a.draft.sources.filter(source => source.status === 'ready' && !superseded.has(source.id));
  const suggestions: { question: string; source: Source }[] = [];
  for (let i = 0; i < 4; i++) {
    for (const source of available) {
      const question = source.suggestedQuestions?.[i] ?? (i === 0 ? `What information is available in "${source.title}"?` : undefined);
      if (question && suggestions.length < 3 && !suggestions.some(item => item.question === question)) suggestions.push({ question, source });
    }
  }
  if (!suggestions.length) return null;
  return <section className="prepared-questions" aria-label="Questions suggested from your sources"><div><span className="studio-section-kicker">Start with what is there</span><h2>A few good questions.</h2><p>Suggested from your current sources. Open one to review and ask it.</p></div><div className="prepared-question-list">{suggestions.map(({ question, source }) => <button type="button" key={question} onClick={() => navigate(`${projectPath(a.id, 'try')}?question=${encodeURIComponent(question)}`)}><MessageSquareText size={17} /><span><strong>{question.replace(/ \(Source: .*\)$/, '')}</strong><small>{source.title}</small></span><ArrowUpRight size={16} /></button>)}</div></section>;
}
