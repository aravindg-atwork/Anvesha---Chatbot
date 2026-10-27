import { useCallback, useState } from 'react';
import { ArrowRight, ChevronLeft, FileSearch, Lock, MessageSquarePlus, RotateCcw, UserCog } from 'lucide-react';
import type { Message } from '../../domain/types';
import { dispatch, useAppState } from '../../domain/store';
import * as op from '../../domain/operations';
import { navigate } from '../router';
import { Button, Modal, Segmented, toast } from '../components/ui';
import { ChatPanel } from '../chat/ChatPanel';
import { SourceInspector } from '../chat/SourceInspector';
import { useChat } from '../chat/useChat';
import { useModelStatus } from '../chat/modelStatus';
import { suggestedQuestions } from '../chat/suggestions';
import { FaqEditor } from './knowledge/FaqManager';
import type { StepProps } from '../App';

function ImproveDialog({ onClose, onChoose }: { onClose: () => void; onChoose: (k: 'faq' | 'behaviour' | 'source') => void }) {
  const opts = [
    { k: 'faq' as const, icon: <MessageSquarePlus size={22} />, t: 'Add the right answer', d: 'Write an approved question and answer for this.' },
    { k: 'behaviour' as const, icon: <UserCog size={22} />, t: 'Change how it helps', d: 'Update who to contact, the tone or the instructions.' },
    { k: 'source' as const, icon: <FileSearch size={22} />, t: 'Check the information', d: 'Fix, replace or add a document.' },
  ];
  return (
    <Modal title="What would make this answer better?" onClose={onClose} description="Nothing changes until you save an edit, and edits apply to your draft only.">
      <div className="stack" style={{ '--gap': '10px' } as React.CSSProperties}>
        {opts.map((o) => (
          <button key={o.k} className="choice" onClick={() => onChoose(o.k)}>
            <span className="choice-icon">{o.icon}</span>
            <span>
              <span className="choice-title">{o.t}</span>
              <span className="choice-desc" style={{ display: 'block' }}>
                {o.d}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function TryStep({ assistant: a, org, mode, onNext, onBack }: StepProps) {
  const chat = useChat(a.id, 'test', mode);
  const modelStatus = useModelStatus();
  const modelPref = useAppState((s) => s.modelPreference);
  const [inspect, setInspect] = useState<{ messageId: string; n: number } | null>(null);
  const [improving, setImproving] = useState<Message | null>(null);
  const [faqFor, setFaqFor] = useState<string | null>(null);

  const d = a.draft;
  const inspected = inspect && chat.messages.find((m) => m.id === inspect.messageId);
  const questionBefore = (m: Message) => {
    const i = chat.messages.findIndex((x) => x.id === m.id);
    return [...chat.messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text ?? '';
  };
  const base = mode === 'setup' ? `/a/${a.id}/setup` : `/a/${a.id}/edit`;

  const isStale = useCallback(
    (m: Message) => (m.draftRevision !== undefined && m.draftRevision !== a.draftRevision ? 'Answered using an earlier draft' : null),
    [a.draftRevision],
  );

  return (
    <div className="screen">
      <div className="screen-head">
        {mode === 'setup' && <span className="eyebrow">Step 4 of 5</span>}
        <h1>Try a question your users might ask.</h1>
      </div>

      <div className={`try-layout ${inspected ? 'with-sources' : ''}`}>
        <ChatPanel
          header={
            <div className="chat-head">
              <span className="row" style={{ '--gap': '10px' } as React.CSSProperties}>
                <span className="pill pill-accent">
                  <Lock size={13} aria-hidden /> Private preview
                </span>
                <span className="muted small">Testing your current draft{a.status === 'live' ? `, not the published version ${a.published?.version}` : ''}.</span>
              </span>
              <span className="row" style={{ '--gap': '8px' } as React.CSSProperties}>
                {modelStatus.modelAvailable && (
                  <Segmented
                    label="Answer engine"
                    value={modelPref}
                    onChange={(v) => dispatch((s) => ({ ...s, modelPreference: v }))}
                    options={[
                      { value: 'demo', label: 'Offline demo' },
                      { value: 'model', label: 'AI model' },
                    ]}
                  />
                )}
                {chat.messages.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<RotateCcw size={15} />}
                    onClick={() => {
                      chat.reset();
                      setInspect(null);
                    }}
                  >
                    New conversation
                  </Button>
                )}
              </span>
            </div>
          }
          messages={chat.messages}
          pending={chat.pending}
          onSend={chat.send}
          onRetry={chat.retry}
          ownerMode
          handover={d.handover}
          orgName={org.name}
          greeting={d.greeting}
          suggestions={suggestedQuestions(d.sources, d.faqs, a.isSample, 5)}
          onViewSources={(m, n) => setInspect({ messageId: m.id, n: n ?? m.answer!.citations[0]?.n ?? 1 })}
          activeMessageId={inspect?.messageId}
          activeCitation={inspect?.n}
          onFeedback={(m, f) => {
            chat.setFeedback(m.id, f);
            if (f === 'down') setImproving(m);
            else toast('Thanks — marked as helpful.');
          }}
          isStale={isStale}
          errorText={chat.lastError?.message}
        />
        {inspected && inspected.answer && inspected.answer.citations.length > 0 && (
          <SourceInspector
            citations={inspected.answer.citations}
            active={inspect!.n}
            onSelect={(n) => setInspect({ ...inspect!, n })}
            onClose={() => setInspect(null)}
            lookupSource={(id) => d.sources.find((s) => s.id === id)}
            footer={
              <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(`${base}/knowledge`)}>
                Open this information
              </button>
            }
          />
        )}
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> {mode === 'setup' ? 'Back' : 'Done'}
        </button>
        {mode === 'setup' && (
          <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={onNext}>
            Continue to sharing
          </Button>
        )}
      </div>

      {improving && (
        <ImproveDialog
          onClose={() => setImproving(null)}
          onChoose={(k) => {
            const m = improving;
            setImproving(null);
            if (k === 'faq') setFaqFor(questionBefore(m));
            if (k === 'behaviour') navigate(`${base}/${mode === 'setup' ? 'review' : 'behaviour'}?focus=handover`);
            if (k === 'source') navigate(`${base}/knowledge`);
          }}
        />
      )}
      {faqFor !== null && (
        <FaqEditor
          title="Add the right answer"
          note="This becomes a question and answer in your draft. Test it here, then publish when you’re happy."
          initial={{ question: faqFor, answer: '', visibility: 'internal' }}
          requireApproval
          onClose={() => setFaqFor(null)}
          onSave={(v) => {
            dispatch((s) => op.addFaq(s, a.id, { ...v, approved: true, createdFrom: 'feedback' }));
            toast('Saved to the draft. Ask again to see the difference.');
          }}
        />
      )}
    </div>
  );
}
