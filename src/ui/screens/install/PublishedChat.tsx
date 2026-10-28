import { useState } from 'react';
import type { Assistant } from '../../../domain/types';
import { ChatPanel } from '../../chat/ChatPanel';
import { SourceInspector } from '../../chat/SourceInspector';
import { useChat } from '../../chat/useChat';
import { starterQuestionsFor } from '../../chat/suggestions';

/**
 * End-user conversation. Always answers from the published snapshot, never the draft,
 * and shows no owner controls, evidence labels or testing notes.
 */
export function PublishedChat({ a, orgName, surface, compact, showInspector = true }: { a: Assistant; orgName: string; surface: string; compact?: boolean; showInspector?: boolean }) {
  const chat = useChat(a.id, 'published', surface);
  const [inspect, setInspect] = useState<{ messageId: string; n: number } | null>(null);
  const snap = a.published;
  const live = a.status === 'live' && snap;
  const inspected = inspect && chat.messages.find((m) => m.id === inspect.messageId);

  const panel = (
    <ChatPanel
      messages={chat.messages}
      pending={chat.pending}
      onSend={chat.send}
      onRetry={chat.retry}
      ownerMode={false}
      handover={snap?.handover ?? { contact: '', process: '' }}
      orgName={orgName}
      greeting={live ? a.share.widget.greeting || snap.greeting : undefined}
      suggestions={live ? starterQuestionsFor(snap.starterQuestions, snap.sources, snap.faqs, a.isSample, compact ? 2 : 3) : []}
      onViewSources={showInspector ? (m, n) => setInspect({ messageId: m.id, n: n ?? 1 }) : undefined}
      activeMessageId={inspect?.messageId}
      activeCitation={inspect?.n}
      onFeedback={(m, f) => chat.setFeedback(m.id, f)}
      isStale={(m) => (m.snapshotVersion !== undefined && snap && m.snapshotVersion !== snap.version ? 'Answered by an earlier version' : null)}
      compact={compact}
      disabledReason={live ? undefined : 'This assistant isn’t available right now'}
      errorText={chat.lastError?.message}
    />
  );

  if (!showInspector || !inspected?.answer?.citations.length) return panel;
  return (
    <div className="try-layout with-sources" style={compact ? { gridTemplateColumns: '1fr' } : undefined}>
      {panel}
      <SourceInspector
        citations={inspected.answer.citations}
        active={inspect!.n}
        onSelect={(n) => setInspect({ ...inspect!, n })}
        onClose={() => setInspect(null)}
        lookupSource={(id) => snap?.sources.find((s) => s.id === id)}
      />
    </div>
  );
}
