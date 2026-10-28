import { useState } from 'react';
import { ExternalLink, FileText, MessagesSquare, MonitorSmartphone, History, CircleAlert } from 'lucide-react';
import type { Assistant, Organisation } from '../../domain/types';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { hasUnpublishedChanges } from '../../domain/publish';
import { navigate } from '../router';
import { Button, Confirm, formatDateTime, toast } from '../components/ui';
import { ProjectShell, projectPath } from '../App';

export function HomeScreen({ a, org }: { a: Assistant; org: Organisation }) {
  const [confirm, setConfirm] = useState(false);
  const conversations = useAppState((s) => s.conversations);
  const published = conversations.filter((c) => c.assistantId === a.id && c.channel === 'published');
  const unanswered = published.flatMap((c) => c.messages).filter((m) => m.answer && (m.answer.kind === 'no-info')).length;
  const questions = published.reduce((n, c) => n + c.messages.filter((m) => m.role === 'user').length, 0);
  // The five latest questions people asked the published assistant, newest first.
  const recent = published
    .flatMap((c) =>
      c.messages.flatMap((m, i) =>
        m.role === 'user' ? [{ id: m.id, at: m.at, question: m.text, answered: c.messages[i + 1]?.answer?.kind === 'answer' }] : [],
      ),
    )
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 5);

  const actions = [
    {
      icon: <FileText size={22} />,
      t: 'Update information',
      d: `${a.draft.sources.length} sources · ${a.draft.faqs.length} questions and answers`,
      to: projectPath(a.id, 'upload'),
    },
    {
      icon: <MessagesSquare size={22} />,
      t: 'Review conversations',
      d: questions ? `${questions} question${questions === 1 ? '' : 's'} asked${unanswered ? ` · ${unanswered} unanswered` : ''}` : 'No conversations yet',
      to: projectPath(a.id, 'conversations'),
    },
    {
      icon: <MonitorSmartphone size={22} />,
      t: 'Manage installation',
      d: a.share.channel === 'application' ? 'In your application' : 'On your website',
      to: projectPath(a.id, 'publish'),
    },
  ];

  return (
    <ProjectShell a={a} org={org} current="overview">
      <section className="home-hero">
        <div className="stack" style={{ '--gap': '12px', maxWidth: 680 } as React.CSSProperties}>
          <div className="row" style={{ '--gap': '14px' } as React.CSSProperties}>
            <h1>{a.status === 'live' ? `${a.published?.name ?? a.draft.name} is live` : a.status === 'unpublished' ? 'Not answering right now' : 'Not published yet'}</h1>
          </div>
          {a.published && (
            <p className="faint small">
              Published {formatDateTime(a.published.publishedAt)} · {a.published.audience === 'public' ? 'Anyone' : 'Authorised users (simulated sign-in)'}
              {hasUnpublishedChanges(a) && ' · draft has unpublished changes'}
            </p>
          )}
        </div>
        <div className="row">
          {a.status === 'live' ? (
            <>
              <a className="btn btn-primary btn-lg" href={`#/chat/${a.publicId}`} target="_blank" rel="noreferrer">
                Open assistant <ExternalLink size={18} />
              </a>
              <Button variant="danger" onClick={() => setConfirm(true)}>
                Unpublish now
              </Button>
            </>
          ) : (
            <Button variant="primary" size="lg" onClick={() => navigate(projectPath(a.id, 'publish'))}>
              {a.status === 'unpublished' ? 'Publish again' : 'Publish'}
            </Button>
          )}
        </div>
      </section>

      <div className="action-grid">
        {actions.map((x) => (
          <button key={x.t} className="action-card" onClick={() => navigate(x.to)}>
            <span className="choice-icon">{x.icon}</span>
            <span className="choice-title" style={{ fontSize: '1.15rem' }}>
              {x.t}
            </span>
            <span className="muted">{x.d}</span>
          </button>
        ))}
      </div>

      {unanswered > 0 && (
        <div className="panel spread" style={{ marginTop: 20 }}>
          <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
            <CircleAlert size={18} aria-hidden style={{ color: 'var(--warn)' }} />
            {unanswered} question{unanswered === 1 ? ' was' : 's were'} not answered. You can add approved answers for them.
          </span>
          <Button size="sm" onClick={() => navigate(projectPath(a.id, 'conversations'))}>
            Review
          </Button>
        </div>
      )}

      <div className="split" style={{ marginTop: 28, alignItems: 'start' }}>
        <section className="card card-pad stack" style={{ '--gap': '12px' } as React.CSSProperties} aria-labelledby="recent-q">
          <div className="spread">
            <h2 id="recent-q" style={{ fontSize: '1.1rem' }}>
              Recent questions
            </h2>
            <button className="link-btn small" onClick={() => navigate(projectPath(a.id, 'conversations'))}>
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="muted">Nobody has asked anything yet. Open the assistant and ask the first question.</p>
          ) : (
            <ul className="plain-list">
              {recent.map((r) => (
                <li key={r.id} className="spread" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.question}</span>
                  <span className={`pill ${r.answered ? 'pill-ok' : 'pill-warn'}`}>{r.answered ? 'Answered' : 'Not answered'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card card-pad stack" style={{ '--gap': '12px' } as React.CSSProperties} aria-labelledby="live-v">
          <div className="spread">
            <h2 id="live-v" style={{ fontSize: '1.1rem' }}>
              {a.published ? `In version ${a.published.version}` : 'Nothing published yet'}
            </h2>
            <button className="link-btn small" onClick={() => navigate(projectPath(a.id, 'settings'))}>
              All versions
            </button>
          </div>
          {a.published && (
            <ul className="plain-list">
              {a.published.sources.map((s) => (
                <li key={s.id} className="spread" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                  <span className="faint small tabular">{s.chunks.length} passages</span>
                </li>
              ))}
              <li className="spread">
                <span>Questions and answers</span>
                <span className="faint small tabular">{a.published.faqs.length}</span>
              </li>
            </ul>
          )}
        </section>
      </div>

      <div className="row" style={{ marginTop: 28, paddingBottom: 48 }}>
        <Button variant="ghost" icon={<History size={17} />} onClick={() => navigate(projectPath(a.id, 'settings'))}>
          Versions and settings
        </Button>
        <Button variant="ghost" onClick={() => navigate(projectPath(a.id, 'try'))}>
          Try the draft
        </Button>
      </div>

      {confirm && (
        <Confirm
          title="Unpublish now?"
          body="The assistant stops answering immediately, everywhere it is installed. Your draft and settings are kept."
          confirmLabel="Unpublish"
          danger
          onConfirm={() => {
            dispatch((s) => op.unpublish(s, a.id));
            toast('Unpublished. The assistant has stopped answering.');
          }}
          onClose={() => setConfirm(false)}
        />
      )}
    </ProjectShell>
  );
}
