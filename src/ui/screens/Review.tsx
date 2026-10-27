import { useEffect, useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { dispatch } from '../../domain/store';
import * as op from '../../domain/operations';
import { generatedInstructions } from '../../domain/templates';
import { Button, Field } from '../components/ui';
import type { StepProps } from '../App';

const LANGUAGES = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati'];

export function ReviewStep({ assistant: a, org, mode, onNext, onBack }: StepProps) {
  const d = a.draft;
  const set = (patch: Partial<typeof d>) => dispatch((s) => op.updateDraft(s, a.id, patch));
  const handoverRef = useRef<HTMLInputElement>(null);
  const generated = generatedInstructions(d, org.name);

  useEffect(() => {
    if (window.location.hash.includes('focus=handover')) {
      handoverRef.current?.scrollIntoView({ block: 'center' });
      handoverRef.current?.focus();
    }
  }, []);

  return (
    <div className="screen narrow" style={{ margin: '0 auto' }}>
      <div className="screen-head">
        {mode === 'setup' && <span className="eyebrow">Step 3 of 5</span>}
        <h1>Here’s how your assistant will help.</h1>
      </div>

      <div className="stack" style={{ '--gap': '32px' } as React.CSSProperties}>
        <section className="card card-pad stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <Field label="Name">{(id) => <input id={id} className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
          <Field label="Purpose">{(id) => <textarea id={id} className="textarea" rows={2} value={d.purpose} onChange={(e) => set({ purpose: e.target.value })} />}</Field>
          <div className="split" style={{ gap: 20 }}>
            <Field label="Language">
              {(id) => (
                <select id={id} className="select" value={d.language} onChange={(e) => set({ language: e.target.value })}>
                  {LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              )}
            </Field>
            <div />
          </div>
          <Field label="Greeting" hint="The first message people see.">
            {(id, h) => <textarea id={id} aria-describedby={h} className="textarea" rows={2} value={d.greeting} onChange={(e) => set({ greeting: e.target.value })} />}
          </Field>
        </section>

        <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.4rem' }}>How it should help</h2>
          <Field label="In plain words" hint="Describe the tone and approach, as you would to a new colleague.">
            {(id, h) => (
              <textarea id={id} aria-describedby={h} className="textarea" rows={5} value={d.behaviour} onChange={(e) => set({ behaviour: e.target.value })} style={{ fontSize: '1.08rem' }} />
            )}
          </Field>
        </section>

        <section className="stack" style={{ '--gap': '14px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.4rem' }}>When people need more help</h2>
          <Field label="Who should people contact?" optional hint="For example: the HR Care desk at hrcare@example.com or extension 2040.">
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
            <p className="muted">
              The full instructions the assistant follows. They are built from the settings above. Edit them only if you need something specific.
            </p>
            <label className="sr-only" htmlFor="custom-instructions">
              Custom instructions
            </label>
            <textarea
              id="custom-instructions"
              className="textarea mono"
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
          <ChevronLeft size={18} /> {mode === 'setup' ? 'Back' : 'Done'}
        </button>
        {mode === 'setup' ? (
          <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={onNext} disabled={!d.name.trim()}>
            Continue
          </Button>
        ) : (
          <span className="faint small">Changes are saved to your draft. Publish to make them live.</span>
        )}
      </div>
    </div>
  );
}
