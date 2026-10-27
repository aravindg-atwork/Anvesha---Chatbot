import { useState } from 'react';
import type { Assistant, Organisation } from '../../domain/types';
import { dispatch, resetEverything, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { navigate } from '../router';
import { Button, Confirm, formatDateTime, toast } from '../components/ui';
import { OwnerShell } from '../App';
import { useModelStatus } from '../chat/modelStatus';

export function SettingsScreen({ a, org }: { a: Assistant; org: Organisation }) {
  const [confirm, setConfirm] = useState<'conversations' | 'sample' | 'all' | null>(null);
  const status = useModelStatus();
  const convCount = useAppState((s) => s.conversations.filter((c) => c.assistantId === a.id).length);

  return (
    <OwnerShell a={a} back={{ label: `${a.draft.name} home`, to: `/a/${a.id}` }}>
      <div className="screen narrow" style={{ paddingTop: 16 }}>
        <div className="screen-head">
          <h1>Versions and settings</h1>
        </div>
        <div className="stack" style={{ '--gap': '36px' } as React.CSSProperties}>
          <section className="stack">
            <h2 style={{ fontSize: '1.4rem' }}>Published versions</h2>
            {a.history.length === 0 ? (
              <p className="muted">Nothing has been published yet.</p>
            ) : (
              <ul className="list">
                {[...a.history].reverse().map((v) => (
                  <li key={v.id} className="spread">
                    <div>
                      <strong>Version {v.version}</strong>{' '}
                      {a.published?.id === v.id && <span className="pill pill-ok">{a.status === 'live' ? 'Live' : 'Last published'}</span>}
                      <p className="muted small">
                        {formatDateTime(v.publishedAt)} · {v.audience === 'public' ? 'Anyone' : 'Authorised users'} · {v.sources.length} sources, {v.faqs.length} questions and answers
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="faint small">Each version is a fixed copy. Editing the draft never changes a published version.</p>
          </section>

          <section className="stack">
            <h2 style={{ fontSize: '1.4rem' }}>Advanced</h2>
            <div className="panel spread">
              <div>
                <strong>Custom instructions</strong>
                <p className="muted small">{a.draft.customInstructions !== null ? 'Edited by you.' : 'Generated from your settings.'}</p>
              </div>
              <Button size="sm" onClick={() => navigate(`/a/${a.id}/edit/behaviour`)}>
                Open
              </Button>
            </div>
            <div className="panel">
              <strong>Answer engine</strong>
              <p className="muted small">
                {status.modelAvailable
                  ? `An AI model (${status.model}) is configured on the server. You can switch between it and the offline demo engine when trying the draft.`
                  : 'Offline demo engine. It finds and quotes matching passages without an AI model. Add a key to the server’s .env file to enable AI answers.'}
              </p>
            </div>
          </section>

          <section className="stack">
            <h2 style={{ fontSize: '1.4rem' }}>Your data</h2>
            <div className="panel stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <p>In this prototype, everything is stored only in this browser’s local storage:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }} className="muted">
                <li>The text read from your files (the files themselves are not kept after reading).</li>
                <li>Your questions and answers, settings and published versions.</li>
                <li>Conversations: each question, the answer and its sources, and any helpful / not helpful rating. No names or contact details are recorded.</li>
              </ul>
              <p className="muted small">Nothing is sent to a server unless an AI model is configured, in which case only the question and matching passages are sent to it.</p>
            </div>
            <div className="row">
              <Button variant="danger" onClick={() => setConfirm('conversations')} disabled={!convCount}>
                Delete conversations ({convCount})
              </Button>
              {org.isSample && (
                <Button variant="danger" onClick={() => setConfirm('sample')}>
                  Reset demo sample
                </Button>
              )}
              <Button variant="danger" onClick={() => setConfirm('all')}>
                Delete all data in this browser
              </Button>
            </div>
          </section>
        </div>
      </div>
      {confirm === 'conversations' && (
        <Confirm
          title="Delete these conversations?"
          body="All test and published conversations for this assistant will be deleted. This can’t be undone."
          confirmLabel="Delete conversations"
          danger
          onConfirm={() => {
            dispatch((s) => ({ ...s, conversations: s.conversations.filter((c) => c.assistantId !== a.id) }));
            toast('Conversations deleted.');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'sample' && (
        <Confirm
          title="Reset the demo sample?"
          body="VayuTech and its conversations will be removed. Your own organisations are kept."
          confirmLabel="Reset sample"
          danger
          onConfirm={() => {
            dispatch(op.removeSampleData);
            navigate('/demo');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'all' && (
        <Confirm
          title="Delete everything?"
          body="All organisations, assistants, sources, versions and conversations in this browser will be deleted. This can’t be undone."
          confirmLabel="Delete everything"
          danger
          onConfirm={() => {
            resetEverything();
            navigate('/');
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </OwnerShell>
  );
}
