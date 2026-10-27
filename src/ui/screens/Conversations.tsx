import { useState } from 'react';
import { ChevronRight, MessageSquarePlus } from 'lucide-react';
import type { Assistant, Conversation, ConversationChannel, Organisation } from '../../domain/types';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { EVIDENCE_TEXT } from '../../domain/engine/common';
import { Button, formatDateTime, toast } from '../components/ui';
import { AnswerText } from '../chat/ChatPanel';
import { OwnerShell } from '../App';
import { FaqEditor } from './knowledge/FaqManager';

const KIND_LABEL = { answer: 'Answered', clarify: 'Asked to clarify', conflict: 'Conflicting sources', 'no-info': 'Not answered', unavailable: 'Unavailable' } as const;

function metrics(convs: Conversation[]) {
  const answers = convs.flatMap((c) => c.messages.filter((m) => m.answer));
  return [
    { label: 'Conversations', value: convs.length },
    { label: 'Questions asked', value: convs.reduce((n, c) => n + c.messages.filter((m) => m.role === 'user').length, 0) },
    { label: 'Answered with sources', value: answers.filter((m) => m.answer!.citations.length && m.answer!.kind === 'answer').length },
    { label: 'Not answered', value: answers.filter((m) => m.answer!.kind === 'no-info' || m.answer!.kind === 'unavailable').length },
    { label: 'Marked helpful', value: answers.filter((m) => m.feedback === 'up').length },
    { label: 'Marked not helpful', value: answers.filter((m) => m.feedback === 'down').length },
  ];
}

export function ConversationsScreen({ a }: { a: Assistant; org: Organisation }) {
  const [tab, setTab] = useState<ConversationChannel>('published');
  const [openId, setOpenId] = useState<string | null>(null);
  const [faqFor, setFaqFor] = useState<string | null>(null);
  const all = useAppState((s) => s.conversations);
  const convs = all.filter((c) => c.assistantId === a.id && c.channel === tab && c.messages.length).reverse();

  const unanswered = convs.flatMap((c) =>
    c.messages
      .map((m, i) => ({ m, q: c.messages[i - 1] }))
      .filter(({ m, q }) => m.answer?.kind === 'no-info' && q?.role === 'user')
      .map(({ q, m }) => ({ question: q.text, at: m.at, id: m.id })),
  );
  const existing = new Set(a.draft.faqs.map((f) => f.question.trim().toLowerCase()));

  return (
    <OwnerShell a={a} back={{ label: `${a.draft.name} home`, to: `/a/${a.id}` }}>
      <div className="screen" style={{ paddingTop: 16 }}>
        <div className="screen-head">
          <h1>Conversations</h1>
          <p className="lead">See what people ask and where the assistant needs better information.</p>
        </div>
        <nav className="subnav" aria-label="Conversation type">
          <button aria-current={tab === 'published' ? 'page' : undefined} onClick={() => setTab('published')}>
            People using the assistant
          </button>
          <button aria-current={tab === 'test' ? 'page' : undefined} onClick={() => setTab('test')}>
            Your tests
          </button>
        </nav>

        <div className="stack" style={{ '--gap': '32px' } as React.CSSProperties}>
          <section className="stack">
            <div className="metrics">
              {metrics(convs).map((m) => (
                <div key={m.label} className="panel metric">
                  <span className="metric-value">{m.value}</span>
                  <span className="muted small">{m.label}</span>
                </div>
              ))}
            </div>
            <p className="faint small">Counted from the conversations stored in this browser. Nothing here is sample data.</p>
          </section>

          {unanswered.length > 0 && (
            <section className="stack">
              <h2 style={{ fontSize: '1.4rem' }}>Questions without an answer</h2>
              <ul className="list">
                {unanswered.map((u) => (
                  <li key={u.id} className="spread">
                    <div>
                      <p style={{ fontWeight: 600 }}>{u.question}</p>
                      <p className="faint small">{formatDateTime(u.at)}</p>
                    </div>
                    {existing.has(u.question.trim().toLowerCase()) ? (
                      <span className="pill pill-ok">Answer added to draft</span>
                    ) : (
                      <Button size="sm" icon={<MessageSquarePlus size={16} />} onClick={() => setFaqFor(u.question)}>
                        Write an answer
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="stack">
            <h2 style={{ fontSize: '1.4rem' }}>All conversations</h2>
            {convs.length === 0 ? (
              <div className="panel muted">
                {tab === 'published' ? 'Nobody has used the published assistant yet. Try it from “Open assistant”.' : 'You haven’t tested the draft yet.'}
              </div>
            ) : (
              <ul className="list">
                {convs.map((c) => {
                  const first = c.messages.find((m) => m.role === 'user');
                  const open = openId === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        className="spread"
                        style={{ width: '100%', background: 'none', border: 0, textAlign: 'left', cursor: 'pointer', padding: 0, minHeight: 44 }}
                        aria-expanded={open}
                        onClick={() => setOpenId(open ? null : c.id)}
                      >
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ overflowWrap: 'anywhere' }}>{first?.text ?? 'Conversation'}</strong>
                          <span className="faint small" style={{ display: 'block' }}>
                            {formatDateTime(c.startedAt)} · {c.messages.filter((m) => m.role === 'user').length} questions
                          </span>
                        </span>
                        <ChevronRight size={18} style={{ transform: open ? 'rotate(90deg)' : undefined, transition: 'transform .2s' }} />
                      </button>
                      {open && (
                        <div className="stack" style={{ marginTop: 16, '--gap': '14px' } as React.CSSProperties}>
                          {c.messages.map((m) =>
                            m.role === 'user' ? (
                              <div key={m.id} className="bubble-user">
                                {m.text}
                              </div>
                            ) : (
                              <div key={m.id} className="panel stack" style={{ '--gap': '8px' } as React.CSSProperties}>
                                <AnswerText text={m.text} />
                                <div className="row small muted" style={{ '--gap': '12px' } as React.CSSProperties}>
                                  {m.answer && <span>{KIND_LABEL[m.answer.kind]}</span>}
                                  {m.answer && <span>{EVIDENCE_TEXT[m.answer.evidence].label}</span>}
                                  {m.answer?.citations.map((ci) => (
                                    <span key={ci.n}>
                                      [{ci.n}] {ci.sourceTitle}
                                    </span>
                                  ))}
                                  {m.snapshotVersion && <span>Version {m.snapshotVersion}</span>}
                                  {m.feedback && <span>{m.feedback === 'up' ? 'Helpful' : 'Not helpful'}</span>}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
      {faqFor !== null && (
        <FaqEditor
          title="Write an answer"
          note="This adds a question and answer to your draft. People will see it after you publish."
          initial={{ question: faqFor, answer: '', visibility: a.published?.audience === 'public' ? 'public' : 'internal' }}
          requireApproval
          onClose={() => setFaqFor(null)}
          onSave={(v) => {
            dispatch((s) => op.addFaq(s, a.id, { ...v, approved: true, createdFrom: 'feedback' }));
            toast('Added to your draft. Publish to make it live.');
          }}
        />
      )}
    </OwnerShell>
  );
}
