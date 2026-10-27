import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, FileText, MessageCircleQuestion, Share2 } from 'lucide-react';
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
    <div className="demo-card">
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
  return (
    <div className="page">
      <TopBar>
        <span className="topbar-spacer" />
        {session ? (
          <Button size="sm" onClick={() => navigate('/start')}>
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
        <section className="hero">
          <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
            <span className="eyebrow">Your knowledge. Clear answers.</span>
            <h1>
              An assistant that answers from <em>your</em> documents — and shows where.
            </h1>
            <p className="lead">
              Add your policies, FAQs and guides. Anvesha answers questions from that information only, points to the exact passage, and tells people when it doesn’t know.
            </p>
            <div className="row" style={{ '--gap': '14px' } as React.CSSProperties}>
              <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={() => navigate(session ? '/start/new' : '/signup')}>
                Create your assistant
              </Button>
              <Button size="lg" onClick={() => navigate('/demo')}>
                Explore demo
              </Button>
            </div>
          </div>
          <InteractiveExample />
        </section>
        <section className="how" aria-label="How it works">
          {[
            { icon: <FileText size={20} />, t: 'Add what you know', d: 'Upload files, add questions and answers, or write information in your own words.' },
            { icon: <MessageCircleQuestion size={20} />, t: 'Try it privately', d: 'Ask the questions people really ask. Check every answer against its source.' },
            { icon: <Share2 size={20} />, t: 'Share when ready', d: 'Publish to your website or app. Your edits stay private until you publish again.' },
          ].map((x, i) => (
            <div key={x.t} className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <span className="how-num">{i + 1}</span>
              <h3>{x.t}</h3>
              <p className="muted">{x.d}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="footer">
        <div className="container spread">
          <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
            <BookOpen size={15} aria-hidden /> Anvesha prototype. The example uses a fictional company.
          </span>
          <a href="#/demo">Demo launcher</a>
        </div>
      </footer>
    </div>
  );
}
