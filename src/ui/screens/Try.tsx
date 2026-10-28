import { useCallback, useState } from 'react';
import { ArrowRight, ChevronLeft, FileSearch, Lock, MessageSquarePlus, RotateCcw, UserCog } from 'lucide-react';
import type { Message } from '../../domain/types';
import { dispatch, useAppState, isRemoteSession } from '../../domain/store';
import * as op from '../../domain/operations';
import { navigate } from '../router';
import { Button, Modal, Segmented, toast } from '../components/ui';
import { ChatPanel } from '../chat/ChatPanel';
import { SourceInspector } from '../chat/SourceInspector';
import { useChat } from '../chat/useChat';
import { refreshModelStatus, useModelStatus } from '../chat/modelStatus';
import { api } from '../../lib/api';
import { FaqEditor } from './knowledge/FaqManager';
import { StepHeading, projectPath, type StepProps } from '../App';
import { starterQuestionsFor } from '../chat/suggestions';

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

export function TryStep({ assistant: a, org, stepNumber, nextLabel, onNext, onBack }: StepProps) {
  const chat = useChat(a.id, 'test', 'try');
  const modelStatus = useModelStatus();
  const modelPref = useAppState((s) => s.modelPreference);
  const [checking, setChecking] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ messageId: string; n: number } | null>(null);
  const [improving, setImproving] = useState<Message | null>(null);
  const [faqFor, setFaqFor] = useState<string | null>(null);

  const d = a.draft;
  const inspected = inspect && chat.messages.find((m) => m.id === inspect.messageId);
  const questionBefore = (m: Message) => {
    const i = chat.messages.findIndex((x) => x.id === m.id);
    return [...chat.messages.slice(0, i)].reverse().find((x) => x.role === 'user')?.text ?? '';
  };
  const needsTraining = op.needsTraining(a);

  const isStale = useCallback(
    (m: Message) => (m.draftRevision !== undefined && m.draftRevision !== a.draftRevision ? 'Answered using an earlier draft' : null),
    [a.draftRevision],
  );

  return (
    <div className="screen">
      <StepHeading step="try" n={stepNumber} title="Try a question your users might ask." />
      {isRemoteSession() && (
        <div className={`ai-mode-notice ${modelPref === 'model' && (!modelStatus.modelAvailable || modelStatus.modelError || connectionError) ? 'needs-setup' : ''}`}>
          <div><strong>{modelPref === 'demo' ? 'Source quotes · No AI-generated replies' : modelStatus.modelError || connectionError ? 'AI answers · Connection blocked' : modelStatus.modelAvailable ? `AI answers · ${modelStatus.model}` : 'AI answers · Setup required'}</strong>
            <p>{modelPref === 'demo' ? 'This mode shows original passages. Choose AI answers for explanations, summaries and conversational follow-ups.' : connectionError || modelStatus.modelError || (!modelStatus.modelAvailable ? 'Set GOOGLE_API_KEY on the backend to enable Gemini. An AI request will never silently turn into a source quote.' : 'Answers use your sources and conversation context, with citation checks and a second AI review of source support.')}</p></div>
          {modelPref === 'demo' ? <Button size="sm" onClick={() => dispatch((s) => ({ ...s, modelPreference: 'model' }))}>Use AI answers</Button> : <div className="ai-mode-actions"><Button size="sm" loading={checking} onClick={async () => {
            setChecking(true); setConnectionError(null);
            try { await api('/api/model/check', { method: 'POST' }); }
            catch (e) { setConnectionError(e instanceof Error ? e.message : 'AI connection failed.'); }
            finally { await refreshModelStatus(); setChecking(false); }
          }}>Check AI connection</Button>{/prepaid|quota|billing/i.test(connectionError || modelStatus.modelError || '') && <a href="https://ai.studio/projects" target="_blank" rel="noreferrer">Open Gemini billing</a>}</div>}
        </div>
      )}
      {!isRemoteSession() && modelStatus.checked && !modelStatus.modelAvailable && (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          {isRemoteSession() ? 'Answers use your Qdrant search index and quote the matching sources. Set GOOGLE_API_KEY on the backend to enable Gemini answers.' : 'Answers currently quote your sources using the offline engine. Configure GOOGLE_API_KEY on the backend to enable AI answers.'}
        </div>
      )}
      {needsTraining && (
        <div className="notice notice-info" style={{ marginBottom: 20 }}>
          <span style={{ flex: 1 }}>{isRemoteSession() ? 'Your information changed. Prepare the latest sources in Training before asking questions.' : 'Your information changed since the last training. Answers already use the latest version; retrain to refresh the summary.'}</span>
          <button className="link-btn" onClick={() => navigate(projectPath(a.id, 'training'))}>
            Go to Training
          </button>
        </div>
      )}

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
                {(isRemoteSession() || modelStatus.modelAvailable) && (
                  <Segmented
                    label="Answer engine"
                    value={modelPref}
                    onChange={(v) => dispatch((s) => ({ ...s, modelPreference: v }))}
                    options={[
                      { value: 'demo', label: isRemoteSession() ? 'Source quotes' : 'Offline demo' },
                      { value: 'model', label: isRemoteSession() ? 'AI answers' : 'AI model' },
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
          suggestions={starterQuestionsFor(d.starterQuestions, d.sources, d.faqs, a.isSample, 5)}
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
              <button className="link-btn small" style={{ alignSelf: 'flex-start' }} onClick={() => navigate(projectPath(a.id, 'upload'))}>
                Open this information
              </button>
            }
          />
        )}
      </div>

      <div className="action-bar">
        <button className="back-link" onClick={onBack}>
          <ChevronLeft size={18} /> Back
        </button>
        <Button variant="primary" size="lg" iconEnd={<ArrowRight size={20} />} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>

      {improving && (
        <ImproveDialog
          onClose={() => setImproving(null)}
          onChoose={(k) => {
            const m = improving;
            setImproving(null);
            if (k === 'faq') setFaqFor(questionBefore(m));
            if (k === 'behaviour') navigate(`${projectPath(a.id, 'review')}?focus=handover`);
            if (k === 'source') navigate(projectPath(a.id, 'upload'));
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
