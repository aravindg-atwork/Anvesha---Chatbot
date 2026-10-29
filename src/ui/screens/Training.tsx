import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle2, ChevronLeft, Info, RefreshCw } from 'lucide-react';
import { dispatch, isRemoteSession } from '../../domain/store';
import { PreparationCanvas, PreparationStages, PreparedQuestions, SourcePreparationList, useStudioEntrance } from './knowledge/KnowledgeCanvas';
import './knowledge/studio.css';
import { ServerTraining } from './ServerTraining';
import * as op from '../../domain/operations';
import { isOutdated, supersededIds } from '../../domain/knowledge';
import { Button, Notice, formatDate } from '../components/ui';
import { StepHeading, projectPath, type StepProps } from '../App';
import { navigate } from '../router';
import { ConflictList } from './knowledge/Conflicts';
import { suggestedQuestions } from '../chat/suggestions';

const STAGES = ['Reading', 'Finding topics', 'Indexing passages', 'Ready'] as const;
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * "Training" prepares the owner's information for answering: it checks every source, lists the
 * topics found and builds the search index. No AI model is trained, and the screen says so.
 */
export function TrainingStep(props: StepProps) {
  return isRemoteSession() ? <ServerTraining {...props} /> : <DemoTrainingStep {...props} />;
}

function DemoTrainingStep({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const d = a.draft;
  const studioRef = useStudioEntrance();
  const stale = op.needsTraining(a);
  const ready = d.sources.filter((s) => s.status === 'ready');
  const total = ready.length * 3;
  const [active, setActive] = useState(stale);
  const [tick, setTick] = useState(() => (stale && !reducedMotion() ? 0 : total));
  const running = active && tick < total;

  useEffect(() => {
    if (!active) return;
    if (reducedMotion() || tick >= total) {
      dispatch((s) => op.markTrained(s, a.id));
      setActive(false);
      return;
    }
    const t = setTimeout(() => setTick((x) => x + 1), 260);
    return () => clearTimeout(t);
  }, [active, tick, total, a.id]);

  const superseded = supersededIds(d.sources);
  const passages = ready.reduce((n, s) => n + s.chunks.length, 0);
  const topics = useMemo(() => {
    const seen = new Set<string>();
    for (const s of ready) {
      if (superseded.has(s.id)) continue;
      for (const c of s.chunks) {
        if (c.locator.kind !== 'section') continue;
        const t = c.locator.heading.replace(/^\d+(\.\d+)*\.?\s*/, '').replace(/\s*\(part \d+\)$/, '');
        if (t.length > 2 && t.length < 48) seen.add(t);
      }
    }
    return Array.from(seen).slice(0, 16);
  }, [ready, superseded]);
  const attention = d.sources.filter((s) => s.status === 'attention');
  const outdated = ready.filter((s) => isOutdated(s.reviewBy));
  const openConflicts = d.conflicts.filter((c) => !c.resolution).length;
  const canAnswer = suggestedQuestions(d.sources, d.faqs, a.isSample, 4);

  return (
    <div className="screen training-studio demo-training-studio" ref={studioRef}>
      <header className="knowledge-studio-hero" data-studio-enter><div><span className="studio-section-kicker"><span>02</span> The preparation room</span><StepHeading
        step="training"
        n={stepNumber}
        title={running ? 'Preparing your information…' : 'Your assistant is ready to answer.'}
        intro={running ? 'Anvesha is reading each source and organising it so answers can point to the right passage.' : undefined}
      /></div><span className="preparation-state-badge">Browser demo</span></header>
      <div className="preparation-overview" data-studio-enter><PreparationCanvas running={running} ready={!running} sources={d.sources.length} passages={passages} demo task={running ? 'Demo: preparing example sources' : undefined} /><PreparationStages ready={!running} running={running} activeStep={Math.min(4, Math.floor(tick / Math.max(1, total) * 5))} /></div>

      {running ? (
        <div className="card card-pad stack" style={{ '--gap': '18px' } as React.CSSProperties} role="status" aria-live="polite">
          {ready.map((s, i) => {
            const stage = Math.max(0, Math.min(3, tick - i * 3));
            const pct = Math.round((stage / 3) * 100);
            return (
              <div key={s.id} className="stack" style={{ '--gap': '6px' } as React.CSSProperties}>
                <div className="spread">
                  <strong style={{ overflowWrap: 'anywhere' }}>{s.title}</strong>
                  <span className={`small ${stage === 3 ? '' : 'muted'}`} style={stage === 3 ? { color: 'var(--ok)' } : undefined}>
                    {stage === 3 ? <CheckCircle2 size={15} style={{ verticalAlign: -2 }} /> : null} {STAGES[stage]}
                  </span>
                </div>
                <span className="progress" aria-hidden>
                  <span style={{ width: `${pct}%` }} />
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
          <PreparedQuestions a={a} />
          <SourcePreparationList a={a} />

          {topics.length > 0 && (
            <section className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
              <h2 style={{ fontSize: '1.35rem' }}>Topics it learned</h2>
              <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                {topics.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          {canAnswer.length > 0 && (
            <section className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
              <h2 style={{ fontSize: '1.35rem' }}>Questions it can help with</h2>
              <ul className="list">
                {canAnswer.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </section>
          )}

          {(attention.length > 0 || outdated.length > 0 || openConflicts > 0) && (
            <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
              <h2 style={{ fontSize: '1.35rem' }}>Needs your attention</h2>
              {attention.map((s) => (
                <Notice key={s.id} tone="danger" icon={<AlertCircle size={18} />}>
                  <div className="spread">
                    <span>
                      <strong>{s.title}</strong> couldn’t be used. {s.attention}
                    </span>
                    <Button size="sm" onClick={() => navigate(projectPath(a.id, 'upload'))}>
                      Fix in Upload
                    </Button>
                  </div>
                </Notice>
              ))}
              {outdated.map((s) => (
                <Notice key={s.id} tone="warn" icon={<CalendarClock size={18} />}>
                  <strong>{s.title}</strong> was due for review on {formatDate(s.reviewBy)}. Answers will mention that it may be out of date.
                </Notice>
              ))}
              <ConflictList a={a} />
            </section>
          )}

          <div className="row small muted" style={{ '--gap': '8px' } as React.CSSProperties}>
            <Info size={16} aria-hidden />
            Training here means organising your information so answers can be found and cited. Your documents are not used to train an AI model.
          </div>
          <div>
            <Button
              icon={<RefreshCw size={16} />}
              onClick={() => {
                setTick(0);
                setActive(true);
              }}
            >
              Train again
            </Button>
          </div>
        </div>
      )}

      <div className="action-bar knowledge-studio-footer">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} disabled={running} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
