import { useState } from 'react';
import { AppWindow, ArrowRight, CheckCircle2, ChevronLeft, Globe2, Users } from 'lucide-react';
import type { Audience, Channel } from '../../domain/types';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { hasUnpublishedChanges, planPublication } from '../../domain/publish';
import { Button, Confirm, Notice, formatDateTime, toast } from '../components/ui';
import { StepHeading, type StepProps } from '../App';
import { WidgetSetup } from './install/WidgetSetup';
import { ApiSetup } from './install/ApiSetup';

type Phase = 'audience' | 'channel' | 'review' | 'install';

function Choice({ selected, onClick, icon, title, desc }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button className="choice" role="radio" aria-checked={selected} onClick={onClick} style={{ padding: 24 }}>
      <span className="choice-icon">{icon}</span>
      <span>
        <span className="choice-title">{title}</span>
        <span className="choice-desc" style={{ display: 'block' }}>
          {desc}
        </span>
      </span>
    </button>
  );
}

export function ShareStep({ assistant: a, stepNumber, onNext, onBack }: StepProps) {
  const live = a.status === 'live';
  const [phase, setPhase] = useState<Phase>(() =>
    live && !hasUnpublishedChanges(a) ? 'install' : !a.share.audience ? 'audience' : !a.share.channel ? 'channel' : 'review',
  );
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const orgName = useAppState((s) => s.orgs.find((o) => o.id === a.orgId)?.name ?? '');
  const setShare = (p: { audience?: Audience; channel?: Channel }) => dispatch((s) => op.updateShare(s, a.id, p));
  const plan = planPublication(a, a.share.audience ?? 'authorised');

  const back = () => {
    if (phase === 'audience') onBack();
    else if (phase === 'channel') setPhase('audience');
    else if (phase === 'review') setPhase('channel');
    else setPhase('review');
  };

  return (
    <div className="screen narrow" style={{ margin: '0 auto', maxWidth: phase === 'install' ? 1120 : undefined }}>
      <StepHeading step="publish" n={stepNumber} title="Choose how people will use your assistant." />

      {phase === 'audience' && (
        <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.35rem' }}>Who will use it?</h2>
          <div className="choices" role="radiogroup" aria-label="Audience">
            <Choice
              selected={a.share.audience === 'public'}
              onClick={() => setShare({ audience: 'public' })}
              icon={<Globe2 size={22} />}
              title="Anyone"
              desc="Open to the public. Only information you mark as public is used."
            />
            <Choice
              selected={a.share.audience === 'authorised'}
              onClick={() => setShare({ audience: 'authorised' })}
              icon={<Users size={22} />}
              title="Only authorised users"
              desc="For your staff or members. Internal information can be used."
            />
          </div>
          {a.share.audience === 'authorised' && (
            <Notice tone="warn">
              Sign-in for authorised users is <strong>simulated</strong> in this prototype. It is a label only and does not protect the assistant. Don’t use it for confidential information yet.
            </Notice>
          )}
          {a.share.audience === 'public' && (
            <Notice>
              {plan.included.length} source{plan.included.length === 1 ? ' is' : 's are'} marked public. Internal information will be left out. You can change this in each source’s details.
            </Notice>
          )}
        </div>
      )}

      {phase === 'channel' && (
        <div className="stack" style={{ '--gap': '20px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.35rem' }}>Where will people use it?</h2>
          <div className="choices" role="radiogroup" aria-label="Where">
            <Choice
              selected={a.share.channel === 'website'}
              onClick={() => setShare({ channel: 'website' })}
              icon={<Globe2 size={22} />}
              title="On my website"
              desc="A chat window on your site or intranet."
            />
            <Choice
              selected={a.share.channel === 'application'}
              onClick={() => setShare({ channel: 'application' })}
              icon={<AppWindow size={22} />}
              title="In my application"
              desc="Your developers connect it to your own app."
            />
          </div>
        </div>
      )}

      {phase === 'review' && (
        <div className="stack" style={{ '--gap': '24px' } as React.CSSProperties}>
          <h2 style={{ fontSize: '1.35rem' }}>{live ? 'Review your changes before publishing' : 'Review before publishing'}</h2>
          <div className="card card-pad stack" style={{ '--gap': '18px' } as React.CSSProperties}>
            <div className="spread">
              <strong>Who</strong>
              <span>
                {a.share.audience === 'public' ? 'Anyone' : 'Only authorised users (simulated)'}{' '}
                <button className="link-btn" onClick={() => setPhase('audience')}>
                  Change
                </button>
              </span>
            </div>
            <hr className="divider" />
            <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
              <strong>Information included</strong>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {plan.included.map((s) => (
                  <li key={s.id}>{s.title}</li>
                ))}
                {plan.faqsIncluded.length > 0 && <li>{plan.faqsIncluded.length} questions and answers</li>}
              </ul>
              {(plan.excluded.length > 0 || plan.faqsExcluded.length > 0) && (
                <>
                  <strong style={{ marginTop: 6 }}>Left out</strong>
                  <ul style={{ margin: 0, paddingLeft: 20 }} className="muted">
                    {plan.excluded.map((e) => (
                      <li key={e.source.id}>
                        {e.source.title} — {e.reason.toLowerCase()}
                      </li>
                    ))}
                    {plan.faqsExcluded.map((e) => (
                      <li key={e.faq.id}>
                        {e.faq.code} — {e.reason.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
          {plan.blocking.map((w) => (
            <Notice key={w} tone="danger">
              {w}
            </Notice>
          ))}
          {plan.warnings.map((w) => (
            <Notice key={w} tone="warn">
              {w}
            </Notice>
          ))}
          <p className="muted">
            Publishing saves a fixed copy of this version. Later edits stay in your draft until you publish again. Installing it on your website or app is a separate step.
          </p>
        </div>
      )}

      {phase === 'install' && a.published && (
        <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
          {live ? (
            <Notice tone="ok">
              <div className="spread">
                <span>
                  <strong>Version {a.published.version} is published</strong> · {formatDateTime(a.published.publishedAt)}. It is not on your website or app until it is installed there.
                </span>
                <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                  <a className="btn btn-sm" href={`#/chat/${a.publicId}`} target="_blank" rel="noreferrer">
                    Open assistant
                  </a>
                  <Button size="sm" variant="danger" onClick={() => setConfirmUnpublish(true)}>
                    Unpublish
                  </Button>
                </span>
              </div>
            </Notice>
          ) : (
            <Notice tone="warn">
              <div className="spread">
                <span>
                  <strong>Unpublished.</strong> The assistant isn’t answering anyone. Your installation code stays the same.
                </span>
                <Button size="sm" variant="primary" onClick={() => setPhase('review')}>
                  Publish again
                </Button>
              </div>
            </Notice>
          )}
          {hasUnpublishedChanges(a) && live && (
            <Notice>
              <div className="spread">
                <span>Your draft has changes that aren’t published. The preview below still uses version {a.published.version}.</span>
                <Button size="sm" onClick={() => setPhase('review')}>
                  Review and publish
                </Button>
              </div>
            </Notice>
          )}
          <div className="row">
            <span className="muted">Show setup for</span>
            <div className="segmented" role="radiogroup" aria-label="Integration">
              {(['website', 'application'] as const).map((c) => (
                <button key={c} role="radio" aria-checked={a.share.channel === c} onClick={() => setShare({ channel: c })}>
                  {c === 'website' ? 'Website' : 'Application'}
                </button>
              ))}
            </div>
          </div>
          {a.share.channel === 'application' ? <ApiSetup a={a} /> : <WidgetSetup a={a} orgName={orgName} />}
        </div>
      )}

      <div className="action-bar">
        <button className="back-link" onClick={phase === 'install' ? onBack : back}>
          <ChevronLeft size={18} /> Back
        </button>
        {phase === 'audience' && (
          <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} disabled={!a.share.audience} onClick={() => setPhase('channel')}>
            Continue
          </Button>
        )}
        {phase === 'channel' && (
          <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} disabled={!a.share.channel} onClick={() => setPhase('review')}>
            Continue
          </Button>
        )}
        {phase === 'review' && (
          <Button
            variant="primary"
            size="lg"
            icon={<CheckCircle2 size={20} />}
            disabled={plan.blocking.length > 0}
            onClick={() => {
              dispatch((s) => op.publish(s, a.id));
              toast(`Published. Version ${(a.history.at(-1)?.version ?? 0) + 1} is now answering.`);
              setPhase('install');
            }}
          >
            {live ? 'Publish changes' : a.status === 'unpublished' ? 'Publish again' : 'Publish'}
          </Button>
        )}
        {phase === 'install' && (
          <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={onNext}>
            Go to overview
          </Button>
        )}
      </div>

      {confirmUnpublish && (
        <Confirm
          title="Unpublish now?"
          body="The assistant will stop answering immediately everywhere it is installed. Your draft and settings are kept, and you can publish again at any time."
          confirmLabel="Unpublish"
          danger
          onConfirm={() => {
            dispatch((s) => op.unpublish(s, a.id));
            toast('Unpublished. The assistant has stopped answering.');
          }}
          onClose={() => setConfirmUnpublish(false)}
        />
      )}
    </div>
  );
}
