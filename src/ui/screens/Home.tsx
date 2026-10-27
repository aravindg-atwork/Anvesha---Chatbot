import { useState } from 'react';
import { ExternalLink, FileText, MessagesSquare, MonitorSmartphone, History, CircleAlert } from 'lucide-react';
import type { Assistant, Organisation } from '../../domain/types';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { hasUnpublishedChanges } from '../../domain/publish';
import { navigate } from '../router';
import { Button, Confirm, formatDateTime, toast } from '../components/ui';
import { OwnerShell } from '../App';

export function StatusPill({ a }: { a: Assistant }) {
  if (a.status === 'live')
    return (
      <span className="pill pill-ok">
        <span className="dot" aria-hidden /> Live · version {a.published?.version}
      </span>
    );
  if (a.status === 'unpublished') return <span className="pill pill-warn">Unpublished</span>;
  return <span className="pill">Not published</span>;
}

export function HomeScreen({ a, org }: { a: Assistant; org: Organisation }) {
  const [confirm, setConfirm] = useState(false);
  const conversations = useAppState((s) => s.conversations);
  const published = conversations.filter((c) => c.assistantId === a.id && c.channel === 'published');
  const unanswered = published.flatMap((c) => c.messages).filter((m) => m.answer && (m.answer.kind === 'no-info')).length;
  const questions = published.reduce((n, c) => n + c.messages.filter((m) => m.role === 'user').length, 0);

  const actions = [
    {
      icon: <FileText size={22} />,
      t: 'Update information',
      d: `${a.draft.sources.length} sources · ${a.draft.faqs.length} questions and answers`,
      to: `/a/${a.id}/edit/knowledge`,
    },
    {
      icon: <MessagesSquare size={22} />,
      t: 'Review conversations',
      d: questions ? `${questions} question${questions === 1 ? '' : 's'} asked${unanswered ? ` · ${unanswered} unanswered` : ''}` : 'No conversations yet',
      to: `/a/${a.id}/conversations`,
    },
    {
      icon: <MonitorSmartphone size={22} />,
      t: 'Manage installation',
      d: a.share.channel === 'application' ? 'In your application' : 'On your website',
      to: `/a/${a.id}/edit/share`,
    },
  ];

  return (
    <OwnerShell a={a}>
      <section className="home-hero">
        <div className="stack" style={{ '--gap': '12px', maxWidth: 680 } as React.CSSProperties}>
          <span className="eyebrow">{org.name}</span>
          <div className="row" style={{ '--gap': '14px' } as React.CSSProperties}>
            <h1>{a.draft.name}</h1>
            <StatusPill a={a} />
          </div>
          <p className="lead">{a.published?.purpose ?? a.draft.purpose}</p>
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
            <Button variant="primary" size="lg" onClick={() => navigate(`/a/${a.id}/edit/share`)}>
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
          <Button size="sm" onClick={() => navigate(`/a/${a.id}/conversations`)}>
            Review
          </Button>
        </div>
      )}

      <div className="row" style={{ marginTop: 40, paddingBottom: 60 }}>
        <Button variant="ghost" icon={<History size={17} />} onClick={() => navigate(`/a/${a.id}/settings`)}>
          Versions, advanced and settings
        </Button>
        <Button variant="ghost" onClick={() => navigate(`/a/${a.id}/edit/try`)}>
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
    </OwnerShell>
  );
}
