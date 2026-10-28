import { useState } from 'react';
import type { Assistant, Organisation } from '../../domain/types';
import { dispatch, resetEverything, useAppState, isRemoteSession, flushRemote } from '../../domain/store';
import * as op from '../../domain/operations';
import { navigate } from '../router';
import { Button, Confirm, formatDateTime, toast } from '../components/ui';
import { ProjectShell, projectPath } from '../App';
import { useModelStatus } from '../chat/modelStatus';

export function SettingsScreen({ a, org }: { a: Assistant; org: Organisation }) {
  const remote = isRemoteSession();
  const [confirm, setConfirm] = useState<'conversations' | 'sample' | 'all' | null>(null);
  const status = useModelStatus();
  const convCount = useAppState((s) => s.conversations.filter((c) => c.assistantId === a.id).length);

  return (
    <ProjectShell a={a} org={org} current="settings">
      <div className="screen narrow">
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
              <Button size="sm" onClick={() => navigate(projectPath(a.id, 'review'))}>
                Open
              </Button>
            </div>
            <div className="panel">
              <strong>Answer engine</strong>
              <p className="muted small">
                {status.modelAvailable
                  ? `An AI model (${status.model}) is configured on the server. Choose AI answers for explanations or Source quotes for original passages. Use Check AI connection in Try to verify model access.`
                  : 'Offline demo engine. It finds and quotes matching passages without an AI model. Add a key to the server’s .env file to enable AI answers.'}
              </p>
            </div>
          </section>

          <section className="stack">
            <h2 style={{ fontSize: '1.4rem' }}>Your data</h2>
            <div className="panel stack" style={{ '--gap': '8px' } as React.CSSProperties}>
              <p>{remote ? 'Your account data is saved on the local backend:' : 'In demo mode, everything is stored only in this browser’s local storage:'}</p>
              <ul style={{ margin: 0, paddingLeft: 20 }} className="muted">
                <li>{remote ? 'Original uploads and extracted text are saved on disk. Search vectors are saved in Qdrant.' : 'The text read from your files (the files themselves are not kept after reading).'}</li>
                <li>Your questions and answers, settings and published versions.</li>
                <li>Conversations: each question, the answer and its sources, and any helpful / not helpful rating. No names or contact details are recorded.</li>
              </ul>
              <p className="muted small">{remote ? 'Parsing, OCR and embeddings run locally. In AI mode, the question, assistant instructions, recent conversation and matching passages are sent to Google.' : 'Nothing is sent to a server unless an AI model is configured, in which case the question and matching passages are sent to it.'}</p>
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
                {remote ? 'Delete my workspaces and projects' : 'Delete all data in this browser'}
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
          body={remote ? 'Your workspaces, projects, extracted sources and conversations will be removed from the database. Uploaded originals and old vectors remain on local disk for recovery. Your sign-in account is kept.' : 'All organisations, assistants, sources, versions and conversations in this browser will be deleted. This can’t be undone.'}
          confirmLabel="Delete everything"
          danger
          onConfirm={async () => {
            resetEverything();
            try { await flushRemote(); navigate('/'); }
            catch (e) { toast(e instanceof Error ? e.message : 'Could not save deletion.'); }
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </ProjectShell>
  );
}
