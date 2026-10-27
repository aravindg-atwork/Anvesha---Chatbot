import { useState } from 'react';
import { ArrowRight, ChevronLeft, Sparkles } from 'lucide-react';
import { dispatch } from '../../domain/store';
import * as op from '../../domain/operations';
import { STARTERS } from '../../domain/templates';
import { Button, Field } from '../components/ui';
import type { StepProps } from '../App';

export function DescribeStep({ assistant: a, onNext, onBack }: StepProps) {
  const d = a.draft;
  const [suggested, setSuggested] = useState(Boolean(d.name));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof d>) => dispatch((s) => op.updateDraft(s, a.id, patch));

  const suggest = () => {
    if (!d.description.trim()) return setError('Describe what the assistant should help with first.');
    dispatch((s) => op.applySuggestion(s, a.id));
    setSuggested(true);
  };

  return (
    <div className="screen narrow" style={{ margin: '0 auto' }}>
      <div className="screen-head">
        <span className="eyebrow">Step 1 of 5</span>
        <h1>What would you like your assistant to help with?</h1>
      </div>

      <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
        <div className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
          <span className="field-label" id="starter-label">
            Start from <span className="faint" style={{ fontWeight: 400 }}>(optional)</span>
          </span>
          <div className="row" style={{ '--gap': '10px' } as React.CSSProperties} role="group" aria-labelledby="starter-label">
            {STARTERS.map((s) => (
              <button
                key={s.id}
                className="chip"
                aria-pressed={d.starter === s.id}
                onClick={() => {
                  const patch: Partial<typeof d> = { starter: d.starter === s.id ? null : s.id };
                  if (s.example && (!d.description.trim() || STARTERS.some((x) => x.example === d.description))) patch.description = s.example;
                  set(patch);
                  setError(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="In your own words" hint="Who will use it, and what should it help them with?" error={error ?? undefined}>
          {(id, desc) => (
            <textarea
              id={id}
              aria-describedby={desc}
              className="textarea"
              rows={4}
              style={{ fontSize: '1.15rem', minHeight: 140 }}
              placeholder="Help employees understand our leave policy and benefits."
              value={d.description}
              onChange={(e) => {
                set({ description: e.target.value });
                setError(null);
              }}
            />
          )}
        </Field>

        {!suggested ? (
          <div>
            <Button icon={<Sparkles size={18} />} onClick={suggest}>
              Suggest a name and purpose
            </Button>
          </div>
        ) : (
          <section className="card card-pad stack" style={{ '--gap': '20px' } as React.CSSProperties} aria-label="Suggested identity">
            <div className="spread">
              <h2 style={{ fontSize: '1.3rem' }}>Your assistant</h2>
              <button className="link-btn" onClick={suggest}>
                Suggest again from my description
              </button>
            </div>
            <Field label="Name" hint="People will see this name. Anvesha stays the platform behind it.">
              {(id, desc) => <input id={id} aria-describedby={desc} className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <Field label="Purpose">
              {(id) => <textarea id={id} className="textarea" rows={2} value={d.purpose} onChange={(e) => set({ purpose: e.target.value })} />}
            </Field>
            <p className="faint small">Suggested with a simple template from your description. No AI was used. Edit anything you like.</p>
          </section>
        )}
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <Button
          variant="primary"
          size="lg"
          iconEnd={<ArrowRight size={20} />}
          onClick={() => {
            if (!d.description.trim()) return setError('Describe what the assistant should help with.');
            if (!suggested || !d.name.trim()) {
              dispatch((s) => op.applySuggestion(s, a.id));
              setSuggested(true);
              if (!d.name.trim()) return;
            }
            onNext();
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
