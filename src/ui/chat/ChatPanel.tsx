import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, ArrowUpRight, BookOpen, CircleHelp, History, RotateCw, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import type { AnswerPayload, Handover, Message } from '../../domain/types';
import { EVIDENCE_CAVEAT, EVIDENCE_TEXT } from '../../domain/engine/common';
import { Button } from '../components/ui';
import { ThinkingTool } from '@/components/ui/thinking-tool';

export const METHOD_LABEL: Record<AnswerPayload['method'], string> = {
  'scripted-demo': 'Scripted demo response',
  extractive: 'Quoted from your sources',
  model: 'Written by AI from your sources',
  limitation: 'No answer found',
};
const METHOD_HELP: Record<AnswerPayload['method'], string> = {
  'scripted-demo': 'A prepared demonstration answer for the fictional VayuTech sample. It is shown only while the bundled passage it cites is still in the sources.',
  extractive: 'Matching passages are shown verbatim. No AI model wrote or simplified this reply.',
  model: 'An AI model wrote this answer using only the passages shown as sources.',
  limitation: 'The assistant could not find information that answers this, so it says so instead of guessing.',
};

/** Renders answer text, turning [n] markers into buttons that open the matching source. */
export function AnswerText({ text, onCite, active }: { text: string; onCite?: (n: number) => void; active?: number | null }) {
  return (
    <div className="answer-text">
      {text.split(/\n\n+/).map((para, i) => (
        <p key={i}>
          {para.split(/(\[\d+\])/g).map((part, j) => {
            const m = part.match(/^\[(\d+)\]$/);
            if (!m) return <Fragment key={j}>{part}</Fragment>;
            const n = Number(m[1]);
            return onCite ? (
              <button key={j} className="cite" onClick={() => onCite(n)} aria-label={`Source ${n}`} aria-current={active === n}>
                {n}
              </button>
            ) : (
              <sup key={j} className="cite">
                {n}
              </sup>
            );
          })}
        </p>
      ))}
    </div>
  );
}

export function HandoverNote({ handover, orgName }: { handover: Handover; orgName: string }) {
  return (
    <div className="handover">
      <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
        <UserRound size={17} aria-hidden />
        <strong>Need more help?</strong>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {handover.contact.trim() ? <>Contact {handover.contact.trim()}.</> : <>Please contact {orgName} directly.</>}
        {handover.process.trim() && <> {handover.process.trim()}</>}
      </p>
      <p className="faint small" style={{ marginTop: 4 }}>
        These are contact details only. No request has been sent.
      </p>
    </div>
  );
}

export interface ChatPanelProps {
  messages: Message[];
  pending: boolean;
  onSend: (text: string) => Promise<boolean>;
  onRetry: (messageId: string) => void;
  /** Owner surfaces show evidence, method labels and feedback. End-user surfaces do not. */
  ownerMode: boolean;
  handover: Handover;
  orgName: string;
  greeting?: string;
  suggestions: string[];
  header?: ReactNode;
  onViewSources?: (m: Message, n?: number) => void;
  activeMessageId?: string | null;
  activeCitation?: number | null;
  onFeedback?: (m: Message, f: 'up' | 'down') => void;
  isStale?: (m: Message) => string | null;
  compact?: boolean;
  disabledReason?: string;
  placeholder?: string;
  errorText?: string | null;
}

export function ChatPanel(p: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const empty = p.messages.length === 0;

  useEffect(() => {
    const el = bodyRef.current;
    if (el && p.messages.length) el.scrollTop = el.scrollHeight;
  }, [p.messages.length, p.pending]);

  const submit = async (text: string) => {
    const t = text.trim();
    if (!t || p.pending || p.disabledReason) return;
    setDraft('');
    const ok = await p.onSend(t);
    // Preserve the typed question if answering failed.
    if (!ok) setDraft(t);
    inputRef.current?.focus();
  };

  const composer = (
    <form
      className={`composer ${empty && !p.compact ? 'prominent' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        submit(draft);
      }}
    >
      <label className="sr-only" htmlFor={`composer-${p.compact ? 'w' : 'm'}`}>
        Your question
      </label>
      <textarea
        id={`composer-${p.compact ? 'w' : 'm'}`}
        ref={inputRef}
        className="textarea"
        rows={1}
        value={draft}
        placeholder={p.disabledReason ?? p.placeholder ?? 'Type a question…'}
        disabled={Boolean(p.disabledReason)}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = 'auto';
          e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit(draft);
          }
        }}
      />
      <Button type="submit" variant="primary" className="send-btn" aria-label="Send question" disabled={!draft.trim() || p.pending || Boolean(p.disabledReason)}>
        <ArrowUp size={22} />
      </Button>
    </form>
  );

  const suggestionChips = p.suggestions.length > 0 && (
    <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
      {!p.compact && <span className="faint small">Try one of these</span>}
      <div className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
        {p.suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => submit(s)} disabled={p.pending || Boolean(p.disabledReason)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="chat" aria-label="Conversation" style={p.compact ? { border: 0, boxShadow: 'none', borderRadius: 0, flex: 1, minHeight: 0 } : undefined}>
      {p.header}
      {empty ? (
        <div className="chat-body" ref={bodyRef} style={{ justifyContent: p.compact ? 'flex-start' : undefined }}>
          {p.greeting && (
            <div className="bubble-bot">
              <p>{p.greeting}</p>
            </div>
          )}
          {!p.compact && <div style={{ margin: '0 -20px' }}>{composer}</div>}
          {suggestionChips}
        </div>
      ) : (
        <div className="chat-body" ref={bodyRef} aria-live="polite">
          {p.greeting && (
            <div className="bubble-bot">
              <p>{p.greeting}</p>
            </div>
          )}
          {p.messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="stack" style={{ '--gap': '6px', alignItems: 'flex-end' } as React.CSSProperties}>
                <div className="bubble-user">{m.text}</div>
                {m.error && (
                  <div className="row small" style={{ '--gap': '8px', color: 'var(--danger)' } as React.CSSProperties}>
                    <span>{p.errorText ?? 'This question wasn’t answered.'}</span>
                    <Button size="sm" icon={<RotateCw size={15} />} onClick={() => p.onRetry(m.id)} disabled={p.pending}>
                      Try again
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <BotMessage key={m.id} m={m} p={p} onSuggestion={submit} />
            ),
          )}
          {p.pending && (
            <div className="chat-thinking" role="status" aria-label="Finding an answer">
              <ThinkingTool state="thinking" content="Searching your prepared sources and composing a cited answer. The response will appear once it is ready." />
            </div>
          )}
        </div>
      )}
      {(!empty || p.compact) && composer}
    </section>
  );
}

function BotMessage({ m, p, onSuggestion }: { m: Message; p: ChatPanelProps; onSuggestion: (s: string) => void }) {
  const a = m.answer!;
  const [why, setWhy] = useState(false);
  const stale = p.isStale?.(m);
  const isActive = p.activeMessageId === m.id;
  return (
    <article className="bubble-bot" aria-label="Assistant answer">
      {stale && (
        <span className="stale">
          <History size={14} aria-hidden /> {stale}
        </span>
      )}
      <AnswerText text={a.text} onCite={p.onViewSources ? (n) => p.onViewSources!(m, n) : undefined} active={isActive ? p.activeCitation : null} />
      {a.warnings?.map((warning) => <p className="answer-warning" key={warning}>{warning}</p>)}
      {a.showHandover && a.kind !== 'clarify' && <HandoverNote handover={p.handover} orgName={p.orgName} />}
      <div className="answer-foot">
        {a.citations.length > 0 && p.onViewSources && (
          <Button size="sm" icon={<BookOpen size={16} />} onClick={() => p.onViewSources!(m)} aria-pressed={isActive}>
            View sources
          </Button>
        )}
        {p.ownerMode && a.kind !== 'unavailable' && (
          <>
            <span className={`evidence evidence-${a.evidence}`}>
              <span className="dot" aria-hidden />
              {a.grounding === 'reviewed' ? 'Source support reviewed' : EVIDENCE_TEXT[a.evidence].label}
            </span>
            <button className="icon-btn" style={{ width: 36, height: 36 }} aria-expanded={why} aria-label="How this answer was produced" onClick={() => setWhy(!why)}>
              <CircleHelp size={17} />
            </button>
          </>
        )}
        {(p.ownerMode || a.method === 'model' || a.method === 'extractive') && <span className="answer-method">{a.method === 'model' ? `AI answer${a.model ? ` · ${a.model}` : ''}` : a.method === 'extractive' ? 'Source quote · Not generated by AI' : METHOD_LABEL[a.method]}</span>}
        {p.onFeedback && a.kind !== 'unavailable' && (
          <span className="feedback" style={{ marginLeft: 'auto' }}>
            <span className="faint small">Was this helpful?</span>
            <button className="icon-btn" aria-label="Helpful" aria-pressed={m.feedback === 'up'} onClick={() => p.onFeedback!(m, 'up')}>
              <ThumbsUp size={17} />
            </button>
            <button className="icon-btn" aria-label="Not helpful" aria-pressed={m.feedback === 'down'} onClick={() => p.onFeedback!(m, 'down')}>
              <ThumbsDown size={17} />
            </button>
          </span>
        )}
      </div>
      {a.suggestions && a.suggestions.length > 0 && p.messages.filter((message) => message.role === 'assistant').at(-1)?.id === m.id && (
        <div className="answer-followups" aria-label="Suggested follow-up questions">
          <span>You can ask next</span>
          <div>{a.suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => onSuggestion(suggestion)} disabled={p.pending}>{suggestion}<ArrowUpRight size={14} aria-hidden /></button>)}</div>
        </div>
      )}
      {why && (
        <div className="panel small stack" style={{ '--gap': '6px' } as React.CSSProperties}>
          <p>
            <strong>{EVIDENCE_TEXT[a.evidence].label}.</strong> {a.evidenceReason}
          </p>
          <p>
            <strong>{METHOD_LABEL[a.method]}.</strong> {METHOD_HELP[a.method]}
          </p>
          <p className="faint">{EVIDENCE_CAVEAT}</p>
        </div>
      )}
    </article>
  );
}
