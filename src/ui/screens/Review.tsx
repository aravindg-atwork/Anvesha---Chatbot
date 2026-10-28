import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck, ThumbsDown } from 'lucide-react';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { TONES, generatedInstructions } from '../../domain/templates';
import { Button, Field } from '../components/ui';
import { StepHeading, projectPath, type StepProps } from '../App';
import { navigate } from '../router';

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati'];

export function ReviewStep({ assistant: a, org, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const d = a.draft;
  const set = (patch: Partial<typeof d>) => dispatch((s) => op.updateDraft(s, a.id, patch));
  const handoverRef = useRef<HTMLInputElement>(null);
  const generated = generatedInstructions(d, org.name);
  const conversations = useAppState((s) => s.conversations);

  // Answers the owner marked "not helpful" while trying the assistant.
  const flagged = useMemo(
    () =>
      conversations
        .filter((c) => c.assistantId === a.id && c.channel === 'test')
        .flatMap((c) =>
          c.messages
            .map((m, i) => ({ m, q: c.messages[i - 1] }))
            .filter(({ m, q }) => m.feedback === 'down' && q?.role === 'user')
            .map(({ q, m }) => ({ id: m.id, question: q.text, outdated: m.draftRevision !== a.draftRevision })),
        ),
    [conversations, a.id, a.draftRevision],
  );

  useEffect(() => {
    if (window.location.hash.includes('focus=handover')) {
      handoverRef.current?.scrollIntoView({ block: 'center' });
      handoverRef.current?.focus();
    }
  }, []);

  return (
    <div className="screen narrow" style={{ margin: '0 auto' }}>
      <StepHeading step="review" n={stepNumber} title="Here’s how your assistant will help." intro="Decide how it behaves. Its name and look are in the next step." />

      <div className="stack" style={{ '--gap': '36px' } as React.CSSProperties}>
        {flagged.length > 0 && (
          <section className="panel stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <h2 className="row" style={{ fontSize: '1.2rem', '--gap': '8px' } as React.CSSProperties}>
              <ThumbsDown size={18} aria-hidden /> Answers you marked “not helpful”
            </h2>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {flagged.map((f) => (
                <li key={f.id}>
                  {f.question} {f.outdated && <span className="faint small">· you’ve made changes since</span>}
                </li>
              ))}
            </ul>
            <p className="muted small">
              Adjust the settings below, or add the right answer in{' '}
              <button className="link-btn" onClick={() => navigate(projectPath(a.id, 'upload'))}>
                Upload
              </button>
              , then check again in{' '}
              <button className="link-btn" onClick={() => navigate(projectPath(a.id, 'try'))}>
                Try
              </button>
              .
            </p>
          </section>
        )}

        <section className="card card-pad stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <Field label="Purpose" hint="What it is for, in one sentence.">
            {(id, h) => <textarea id={id} aria-describedby={h} className="textarea" rows={2} value={d.purpose} onChange={(e) => set({ purpose: e.target.value })} />}
          </Field>
          <Field label="Language">
            {(id) => (
              <select id={id} className="select" value={d.language} onChange={(e) => set({ language: e.target.value })} style={{ maxWidth: 320 }}>
                {LANGUAGES.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            )}
          </Field>
        </section>

        <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.4rem' }}>Tone</h2>
          <div className="choices" role="radiogroup" aria-label="Tone">
            {TONES.map((t) => (
              <button key={t.id} className="choice" role="radio" aria-checked={d.tone === t.id} onClick={() => set({ tone: t.id })} style={{ padding: 16 }}>
                <span>
                  <span className="choice-title">{t.label}</span>
                  <span className="choice-desc" style={{ display: 'block' }}>
                    {t.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.4rem' }}>How it should help</h2>
          <Field label="In plain words" hint="Describe the approach, as you would to a new colleague.">
            {(id, h) => (
              <textarea id={id} aria-describedby={h} className="textarea" rows={5} value={d.behaviour} onChange={(e) => set({ behaviour: e.target.value })} style={{ fontSize: '1.08rem' }} />
            )}
          </Field>
        </section>

        <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.4rem' }}>When people need more help</h2>
          <Field label="Who should people contact?" optional hint="For example: the HR Care desk at hrcare@yourcompany.com or extension 2040.">
            {(id, h) => (
              <input
                id={id}
                ref={handoverRef}
                aria-describedby={h}
                className="input"
                value={d.handover.contact}
                onChange={(e) => set({ handover: { ...d.handover, contact: e.target.value } })}
              />
            )}
          </Field>
          <Field label="What should they do?" optional hint="For example: Include your employee ID and the dates you need.">
            {(id, h) => (
              <textarea id={id} aria-describedby={h} className="textarea" rows={2} value={d.handover.process} onChange={(e) => set({ handover: { ...d.handover, process: e.target.value } })} />
            )}
          </Field>
          <p className="faint small">The assistant shows these details. It does not send requests on anyone’s behalf.</p>
        </section>

        <details className="disclosure" open={d.customInstructions !== null || undefined}>
          <summary>
            <ChevronRight size={18} className="chev" aria-hidden /> Custom instructions
            {d.customInstructions !== null && <span className="pill pill-accent">Edited</span>}
          </summary>
          <div className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
            <p className="muted">The full instructions the assistant follows. They are built from the settings above. Edit them only if you need something specific.</p>
            <label className="sr-only" htmlFor="custom-instructions">
              Custom instructions
            </label>
            <textarea
              id="custom-instructions"
              className="textarea"
              rows={16}
              style={{ minHeight: 360, lineHeight: 1.6 }}
              value={d.customInstructions ?? generated}
              onChange={(e) => set({ customInstructions: e.target.value })}
            />
            <div className="spread">
              <span className="row small muted" style={{ '--gap': '8px' } as React.CSSProperties}>
                <ShieldCheck size={16} aria-hidden /> Your documents provide facts only. Text inside them can’t change these instructions.
              </span>
              {d.customInstructions !== null && (
                <button className="link-btn" onClick={() => set({ customInstructions: null })}>
                  Go back to the generated instructions
                </button>
              )}
            </div>
          </div>
        </details>
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
