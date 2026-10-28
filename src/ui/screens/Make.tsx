import { ArrowRight, ArrowUp, ChevronLeft, RotateCcw } from 'lucide-react';
import type { WidgetSettings } from '../../domain/types';
import { dispatch } from '../../domain/store';
import * as op from '../../domain/operations';
import { Button, Field, Segmented } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import { AVATAR_KEYS, Avatar, AvatarGlyph } from '../components/avatar';
import { starterQuestionsFor, suggestedQuestions } from '../chat/suggestions';

export const COLOURS = ['#1d3a5f', '#2e6a4a', '#c8502a', '#7a3b2e', '#4b3f72', '#0f6d7a', '#23211e'];
const AVATARS = ['', ...AVATAR_KEYS];

export function MakeStep({ assistant: a, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const d = a.draft;
  const w = a.share.widget;
  const setDraft = (patch: Partial<typeof d>) => dispatch((s) => op.updateDraft(s, a.id, patch));
  const setWidget = (p: Partial<WidgetSettings>) => dispatch((s) => op.updateShare(s, a.id, { widget: { ...w, ...p } }));
  const suggested = suggestedQuestions(d.sources, d.faqs, a.isSample, 4);
  const starters = d.starterQuestions ?? suggested;
  const preview = starterQuestionsFor(d.starterQuestions, d.sources, d.faqs, a.isSample, 3);

  const setStarter = (i: number, value: string) => {
    const next = [...starters];
    while (next.length < 4) next.push('');
    next[i] = value;
    setDraft({ starterQuestions: next });
  };

  return (
    <div className="screen">
      <StepHeading step="make" n={stepNumber} title="Make it yours." intro="Choose how your assistant looks and greets people. You’ll see the result on the right as you go." />

      <div className="split split-wide" style={{ alignItems: 'start' }}>
        <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
          <Field label="Name" hint="People see this name. Anvesha stays the platform behind it.">
            {(id, h) => <input id={id} aria-describedby={h} className="input" value={d.name} onChange={(e) => setDraft({ name: e.target.value })} />}
          </Field>

          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="field-label" id="avatar-label">
              Avatar
            </span>
            <div className="row" style={{ '--gap': '8px' } as React.CSSProperties} role="radiogroup" aria-labelledby="avatar-label">
              {AVATARS.map((av) => (
                <button
                  key={av || 'initial'}
                  role="radio"
                  aria-checked={d.avatar === av}
                  aria-label={av ? `Avatar ${av}` : 'First letter of the name'}
                  className="avatar-option"
                  onClick={() => setDraft({ avatar: av })}
                >
                  <AvatarGlyph value={av} name={d.name} size={46} />
                </button>
              ))}
            </div>
          </div>

          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="field-label" id="colour-label">
              Colour
            </span>
            <div className="swatches" role="radiogroup" aria-labelledby="colour-label">
              {COLOURS.map((c) => (
                <button key={c} className="swatch" role="radio" aria-checked={w.color === c} aria-label={c} style={{ background: c }} onClick={() => setWidget({ color: c })} />
              ))}
            </div>
          </div>

          <Field label="Greeting" hint="The first message people see.">
            {(id, h) => <textarea id={id} aria-describedby={h} className="textarea" rows={2} value={d.greeting} onChange={(e) => setDraft({ greeting: e.target.value })} />}
          </Field>

          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, '--gap': '10px' } as React.CSSProperties}>
            <legend className="field-label" style={{ marginBottom: 6 }}>
              Starter questions
            </legend>
            <span className="field-hint">Shown as one-tap buttons before people type. Leave a box empty to hide it.</span>
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                className="input"
                aria-label={`Starter question ${i + 1}`}
                value={starters[i] ?? ''}
                placeholder={suggested[i] ?? 'Add a question'}
                onChange={(e) => setStarter(i, e.target.value)}
              />
            ))}
            {d.starterQuestions !== null && (
              <div>
                <button className="link-btn" onClick={() => setDraft({ starterQuestions: null })}>
                  <RotateCcw size={14} style={{ verticalAlign: -2 }} /> Use suggestions from my information
                </button>
              </div>
            )}
          </fieldset>

          <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
            <span className="field-label">On a website</span>
            <div className="row">
              <Segmented
                label="Style"
                value={w.mode}
                onChange={(mode) => setWidget({ mode })}
                options={[
                  { value: 'floating', label: 'Floating button' },
                  { value: 'inline', label: 'Inside the page' },
                ]}
              />
              {w.mode === 'floating' && (
                <Segmented
                  label="Position"
                  value={w.position}
                  onChange={(position) => setWidget({ position })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
              )}
            </div>
          </div>
          <p className="faint small">Colour, avatar and widget style apply straight away. Name, greeting and starter questions reach people when you publish.</p>
        </div>

        <div className="make-preview" aria-label="Preview">
          <span className="label">Preview</span>
          <div className="widget-panel inline" style={{ height: 'auto' }}>
            <div className="widget-head" style={{ background: w.color }}>
              <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
                <Avatar a={a} size={30} inverse />
                <strong>{d.name || 'Your assistant'}</strong>
              </span>
            </div>
            <div className="chat-body" style={{ maxHeight: 'none' }}>
              <div className="bubble-bot">
                <p>{d.greeting || 'Hello! How can I help?'}</p>
              </div>
              <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                {preview.map((q) => (
                  <span key={q} className="chip" style={{ cursor: 'default' }}>
                    {q}
                  </span>
                ))}
              </div>
            </div>
            <div className="composer">
              <div className="textarea" style={{ color: 'var(--text-faint)', minHeight: 46, display: 'flex', alignItems: 'center' }}>
                Type a question…
              </div>
              <span className="btn btn-primary send-btn" style={{ background: w.color, borderColor: w.color, width: 46, height: 46 }} aria-hidden>
                <ArrowUp size={20} />
              </span>
            </div>
          </div>
        </div>
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
