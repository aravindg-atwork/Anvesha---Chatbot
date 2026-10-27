import { useState } from 'react';
import { ArrowRight, LogOut, Plus } from 'lucide-react';
import { dispatch, dispatchWith, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { STEPS } from '../../domain/types';
import { navigate } from '../router';
import { Button, Field, formatDate } from '../components/ui';
import { DemoStrip, STEP_LABEL, TopBar } from '../App';
import { StatusPill } from './Home';

function OrgForm({ onCancel }: { onCancel?: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="stack"
      style={{ '--gap': '28px' } as React.CSSProperties}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError('Enter your organisation’s name.');
        const { assistantId } = dispatchWith((s) => op.createOrganisation(s, name));
        navigate(`/a/${assistantId}/setup/describe`);
      }}
    >
      <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        <h1>What’s the name of your organisation?</h1>
        <p className="lead">We’ll use it to set up your first assistant.</p>
      </div>
      <Field label="Organisation name" error={error ?? undefined}>
        {(id, d) => (
          <input
            id={id}
            aria-describedby={d}
            className="input"
            style={{ fontSize: '1.2rem', minHeight: 58 }}
            placeholder="For example, Greenfield College"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            autoFocus
          />
        )}
      </Field>
      <div className="row">
        <Button type="submit" variant="primary" size="lg" iconEnd={<ArrowRight size={20} />}>
          Continue
        </Button>
        {onCancel && (
          <Button variant="ghost" size="lg" onClick={onCancel}>
            Back
          </Button>
        )}
      </div>
    </form>
  );
}

export function StartScreen({ forceNew }: { forceNew?: boolean }) {
  const state = useAppState((s) => s);
  const [creating, setCreating] = useState(false);
  const showForm = forceNew || creating || state.orgs.length === 0;

  return (
    <div className="page">
      <DemoStrip />
      <TopBar home="/start">
        <span className="topbar-spacer" />
        <Button
          variant="ghost"
          size="sm"
          icon={<LogOut size={16} />}
          onClick={() => {
            dispatch((s) => ({ ...s, session: null }));
            navigate('/');
          }}
        >
          Sign out
        </Button>
      </TopBar>
      <main className="container narrow screen">
        {showForm ? (
          <OrgForm onCancel={state.orgs.length ? () => (forceNew ? navigate('/start') : setCreating(false)) : undefined} />
        ) : (
          <div className="stack" style={{ '--gap': '28px' } as React.CSSProperties}>
            <div className="stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <h1>Your assistants</h1>
              <p className="lead">Pick up where you left off, or open an assistant.</p>
            </div>
            {state.orgs.map((org) => {
              const list = state.assistants.filter((a) => a.orgId === org.id);
              return (
                <section key={org.id} className="stack" style={{ '--gap': '12px' } as React.CSSProperties}>
                  <div className="spread">
                    <h2 style={{ fontSize: '1.3rem' }}>
                      {org.name} {org.isSample && <span className="pill" style={{ marginLeft: 6 }}>Sample</span>}
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus size={16} />}
                      onClick={() => {
                        const { assistantId } = dispatchWith((s) => op.addAssistant(s, org.id));
                        navigate(`/a/${assistantId}/setup/describe`);
                      }}
                    >
                      New assistant
                    </Button>
                  </div>
                  <ul className="list">
                    {list.map((a) => {
                      const step = STEPS.indexOf(a.currentStep) + 1;
                      return (
                        <li key={a.id} className="spread">
                          <div style={{ minWidth: 0 }}>
                            <div className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
                              <strong style={{ fontSize: '1.1rem' }}>{a.draft.name || 'Untitled assistant'}</strong>
                              {a.setupComplete ? <StatusPill a={a} /> : <span className="pill pill-warn">Setup in progress</span>}
                            </div>
                            <p className="muted small">
                              {a.setupComplete
                                ? a.draft.purpose
                                : `Step ${step} of ${STEPS.length}: ${STEP_LABEL[a.currentStep]} · started ${formatDate(a.createdAt)}`}
                            </p>
                          </div>
                          <Button
                            variant={a.setupComplete ? 'secondary' : 'primary'}
                            onClick={() => navigate(a.setupComplete ? `/a/${a.id}` : `/a/${a.id}/setup/${a.currentStep}`)}
                          >
                            {a.setupComplete ? 'Open' : 'Continue setup'}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            <div>
              <Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>
                Add another organisation
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
