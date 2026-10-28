import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnswerPayload, Assistant, ConversationChannel, Message } from '../../domain/types';
import { dispatch, dispatchWith, getState, useAppState, isRemoteSession, flushRemote } from '../../domain/store';
import { api } from '../../lib/api';
import * as op from '../../domain/operations';
import { viewFromDraft, viewFromSnapshot, type KnowledgeView } from '../../domain/knowledge';
import { demoEngine, modelEngine } from '../../domain/engine';
import { uid, nowIso } from '../../lib/id';
import { refreshModelStatus, useModelStatus } from './modelStatus';

const UNAVAILABLE: AnswerPayload = {
  kind: 'unavailable',
  text: 'This assistant isn’t available right now. Please try again later or contact the organisation directly.',
  citations: [],
  evidence: 'none',
  evidenceReason: 'The assistant is not published, so no sources were searched.',
  method: 'limitation',
  showHandover: false,
};

/** Which knowledge a surface answers from. Test chats use the draft; everything else uses the live snapshot. */
export function knowledgeFor(a: Assistant, channel: ConversationChannel): KnowledgeView | null {
  if (channel === 'test') return viewFromDraft(a, op.instructionsFor(getState(), a));
  if (a.status !== 'live' || !a.published) return null;
  return viewFromSnapshot(a.published, a.isSample);
}

export function useChat(assistantId: string, channel: ConversationChannel, surface: string) {
  const pointerKey = `anvesha:conv:${assistantId}:${channel}:${surface}`;
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(pointerKey);
    } catch {
      return null;
    }
  });
  const conversation = useAppState((s) => s.conversations.find((c) => c.id === conversationId) ?? null);
  const modelPref = useAppState((s) => s.modelPreference);
  const modelStatus = useModelStatus();
  const [pending, setPending] = useState(false);
  const [lastError, setLastError] = useState<{ text: string; message: string } | null>(null);

  useEffect(() => {
    try {
      if (conversationId) sessionStorage.setItem(pointerKey, conversationId);
      else sessionStorage.removeItem(pointerKey);
    } catch {
      /* ignore */
    }
  }, [conversationId, pointerKey]);

  const engine = modelPref === 'model' && modelStatus.modelAvailable ? modelEngine : demoEngine;

  const ask = useCallback(
    async (text: string, convId: string, messageId: string) => {
      const a = getState().assistants.find((x) => x.id === assistantId);
      if (!a) return;
      const view = knowledgeFor(a, channel);
      setPending(true);
      setLastError(null);
      try {
        let answer: AnswerPayload;
        if (view && isRemoteSession() && channel === 'test') {
          await flushRemote();
          answer = await api<AnswerPayload>(`/api/projects/${assistantId}/answer`, {
            method: 'POST', body: JSON.stringify({ question: text, engine: modelPref, conversationId: convId, messageId }),
          });
        } else answer = view ? await engine.answer(view, text) : UNAVAILABLE;
        const msg: Message = {
          id: uid('m'),
          role: 'assistant',
          text: answer.text,
          at: nowIso(),
          answer,
          draftRevision: channel === 'test' ? a.draftRevision : undefined,
          snapshotVersion: channel !== 'test' ? a.published?.version : undefined,
        };
        dispatch((s) => op.appendMessage(s, convId, msg));
        // Keep the thinking state until the answer is durable, so an immediate reload cannot lose it.
        if (isRemoteSession()) await flushRemote();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong while answering.';
        setLastError({ text, message });
        throw e;
      } finally {
        setPending(false);
        if (isRemoteSession()) void refreshModelStatus();
      }
    },
    [assistantId, channel, engine, modelPref],
  );

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      let convId = conversationId;
      if (!convId || !getState().conversations.some((c) => c.id === convId)) {
        convId = dispatchWith((s) => op.startConversation(s, assistantId, channel)).conversationId;
        setConversationId(convId);
      }
      const userMsg: Message = { id: uid('m'), role: 'user', text, at: nowIso() };
      dispatch((s) => op.appendMessage(s, convId!, userMsg));
      try {
        await ask(text, convId, userMsg.id);
        return true;
      } catch {
        // Keep the question visible and remove nothing: mark it as unanswered so it can be retried.
        dispatch((s) => op.updateMessage(s, convId!, userMsg.id, { error: 'Not answered' }));
        return false;
      }
    },
    [ask, assistantId, channel, conversationId],
  );

  const retry = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      const m = conversation?.messages.find((x) => x.id === messageId);
      if (!m) return;
      dispatch((s) => op.updateMessage(s, conversationId, messageId, { error: undefined }));
      try {
        await ask(m.text, conversationId, m.id);
      } catch {
        dispatch((s) => op.updateMessage(s, conversationId, messageId, { error: 'Not answered' }));
      }
    },
    [ask, conversation, conversationId],
  );

  const setFeedback = useCallback(
    (messageId: string, feedback: 'up' | 'down') => {
      if (conversationId) dispatch((s) => op.updateMessage(s, conversationId, messageId, { feedback }));
    },
    [conversationId],
  );

  const reset = useCallback(() => setConversationId(null), []);

  return useMemo(
    () => {
      const messages = conversation?.messages ?? [];
      const visible = isRemoteSession() && pending && messages.at(-1)?.role === 'assistant' ? messages.slice(0, -1) : messages;
      return { conversation, messages: visible, send, retry, pending, lastError, setFeedback, reset, engineId: isRemoteSession() ? modelPref : engine.id };
    },
    [conversation, send, retry, pending, lastError, setFeedback, reset, engine.id, modelPref],
  );
}
