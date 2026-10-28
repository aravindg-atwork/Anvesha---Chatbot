import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, FileText, MessageCircleQuestion } from 'lucide-react';
import { useAppState } from '../../domain/store';
import { emptyState, seedSample, instructionsFor } from '../../domain/operations';
import { viewFromDraft, formatLocator } from '../../domain/knowledge';
import { answerExtractive } from '../../domain/engine/extractive';
import { DEMO_QUESTIONS } from '../../demo/vayutech';
import type { AnswerPayload } from '../../domain/types';
import { navigate } from '../router';
import { Button } from '../components/ui';
import { AnswerText } from '../chat/ChatPanel';
import { TopBar } from '../App';
import { ShaderBackground } from '@/components/ui/dark-mono';

/**
 * Staggered entrance for the landing page. Content is visible by default; only when the script runs
 * and motion is allowed does it start hidden and rise into place as each part enters the view.
 */
function useReveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.reveal'));
    els.forEach((el, i) => {
      el.classList.add('reveal-ready');
      el.style.transitionDelay = `${(i % 4) * 80}ms`;
    });
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

const EXAMPLES = [
  { label: 'Emergency leave on probation', q: DEMO_QUESTIONS.emergency },
  { label: 'Annual leave', q: DEMO_QUESTIONS.supported },
  { label: 'Something not covered', q: DEMO_QUESTIONS.unsupported },
];

/** Live example: runs the real offline engine against the bundled fictional sample, without saving anything. */
function InteractiveExample() {
  const view = useMemo(() => {
    const { state, assistantId } = seedSample(emptyState(), 'ready');
    const a = state.assistants.find((x) => x.id === assistantId)!;
    return viewFromDraft(a, instructionsFor(state, a));
  }, []);
  const [q, setQ] = useState(EXAMPLES[0].q);
  const answer: AnswerPayload = useMemo(() => answerExtractive(view, q), [view, q]);
  const c = answer.citations[0];
  const i = c ? c.excerpt.indexOf(c.highlight) : -1;
  return (
    <div className="demo-card" data-ui>
      <div className="chat-head">
        <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
          <strong>AskHR</strong>
          <span className="faint small">Example assistant for fictional VayuTech</span>
        </span>
      </div>
      <div style={{ padding: 20 }} className="stack">
        <div className="row" style={{ '--gap': '8px' } as React.CSSProperties} role="radiogroup" aria-label="Example questions">
          {EXAMPLES.map((e) => (
            <button key={e.q} className="chip" role="radio" aria-checked={q === e.q} aria-pressed={q === e.q} onClick={() => setQ(e.q)} style={{ fontSize: '0.92rem', minHeight: 40 }}>
              {e.label}
            </button>
          ))}
        </div>
        <div className="stack example-scroll" style={{ '--gap': '14px' } as React.CSSProperties} tabIndex={0} aria-label="Example conversation">
          <div className="bubble-user" style={{ alignSelf: 'flex-end' }}>
            {q}
          </div>
          <div className="bubble-bot" aria-live="polite">
            <AnswerText text={answer.text} />
          </div>
        </div>
        {c && (
          <div className="panel stack" style={{ '--gap': '8px' } as React.CSSProperties}>
            <span className="ref-label">
              {c.sourceTitle} · {formatLocator(c.locator)}
            </span>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
              {i >= 0 ? (
                <>
                  {c.excerpt.slice(Math.max(0, i - 80), i).replace(/^\S*\s/, '…')}
                  <mark>{c.highlight}</mark>
                </>
              ) : (
                c.excerpt.slice(0, 220)
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function Landing() {
  const session = useAppState((s) => s.session);
  useReveal();
  return (
    <div className="page landing-experience">
      <TopBar>
        <span className="topbar-spacer" />
        {session ? (
          <Button size="sm" onClick={() => navigate('/projects')}>
            My assistants
          </Button>
        ) : (
          <>
            <a className="btn btn-ghost btn-sm" href="#/signin">
              Sign in
            </a>
            <a className="btn btn-sm hide-sm" href="#/demo">
              Explore demo
            </a>
          </>
        )}
      </TopBar>
      <main className="container">
        <section className="hero landing-hero">
          <div className="landing-shader" aria-hidden><ShaderBackground /></div>
          <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
            <h1 className="reveal">Your knowledge. Clear answers.</h1>
            <p className="lead reveal">
              Turn your policies, FAQs and guides into an assistant that answers only from them, shows the exact passage behind every answer, and says so when it doesn’t know.
            </p>
            <div className="row reveal" style={{ '--gap': '14px' } as React.CSSProperties}>
              <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={() => navigate(session ? '/projects' : '/signup')}>
                Create your assistant
              </Button>
              <Button size="lg" onClick={() => navigate('/demo')}>
                Explore demo
              </Button>
            </div>
          </div>
          <div className="reveal">
            <InteractiveExample />
          </div>
        </section>
        <section className="how" aria-labelledby="how-title">
          <h2 id="how-title" className="how-title reveal">
            From your documents to a cited answer
          </h2>
          <div className="how-grid">
            <div className="how-step reveal">
              <h3>Add what you know</h3>
              <p>Upload files, add questions and answers, or write information in your own words.</p>
              <div className="frag" data-ui aria-hidden>
                <div className="frag-row">
                  <FileText size={18} />
                  <span className="frag-grow">
                    <strong>Leave Policy (2025 edition)</strong>
                    <span className="frag-meta">PDF · 7 passages · Internal only</span>
                  </span>
                  <span className="pill pill-ok">Ready</span>
                </div>
                <div className="frag-row">
                  <FileText size={18} />
                  <span className="frag-grow">
                    <strong>Benefits Guide</strong>
                    <span className="frag-meta">DOCX · 4 passages</span>
                  </span>
                  <span className="pill pill-warn">Review date passed</span>
                </div>
              </div>
            </div>
            <div className="how-step reveal">
              <h3>Try it privately</h3>
              <p>Ask the questions people really ask, and check every answer against its source.</p>
              <div className="frag" data-ui aria-hidden>
                <p className="frag-answer">
                  Because you’re on probation, casual leave isn’t available to you. <span className="cite">1</span>
                </p>
                <p className="frag-source">
                  <span className="frag-meta">Section 3 · Casual leave</span>
                  <mark>Employees on probation are not eligible for casual leave.</mark> Requests concerning family emergencies…
                </p>
              </div>
            </div>
            <div className="how-step reveal">
              <h3>Make it yours</h3>
              <p>Shape its tone, greeting and appearance, then open a preview of your assistant.</p>
              <div className="frag frag-widget" data-ui aria-hidden>
                <div className="frag-widget-head">
                  <MessageCircleQuestion size={16} /> AskHR
                </div>
                <p className="frag-bubble">Hello! Ask me about VayuTech’s policies and benefits.</p>
                <span className="frag-chip">How many days of annual leave do I get?</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="container spread">
          <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            <BookOpen size={15} aria-hidden /> Anvesha · Your knowledge. Clear answers. The example uses a fictional company.
          </span>
          <a href="#/demo">Demo launcher</a>
        </div>
      </footer>
    </div>
  );
}
