import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';

import {
  loadPrivateReaderConversation,
  privateReaderChatMode,
  sendPrivateReaderMessage,
} from '@/lib/privateReaderChat';
import type {
  PrivateReaderConversation,
  PrivateReaderKey,
  PrivateReaderModelChoice,
  ReaderReportEvidence,
} from '@/types';

interface PrivateReaderChatProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  versionId: string;
  reader: PrivateReaderKey;
  readerName: string;
  readerRole: string;
  readerImage: string;
  report: ReaderReportEvidence;
}

interface ProgressiveReply {
  messageId: string;
  tokens: string[];
  visibleTokens: number;
}

const LOCAL_THINKING_DELAY_MS = 450;
const REVEAL_INTERVAL_MS = 24;

function responseTokens(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function responseParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export function PrivateReaderChat({
  open,
  onClose,
  projectId,
  versionId,
  reader,
  readerName,
  readerRole,
  readerImage,
  report,
}: PrivateReaderChatProps) {
  const [conversation, setConversation] = useState<PrivateReaderConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [modelChoice, setModelChoice] = useState<PrivateReaderModelChoice>('auto');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [progressiveReply, setProgressiveReply] = useState<ProgressiveReply | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const mode = privateReaderChatMode();
  const readerFirstName = readerName.split(' ')[0];

  useEffect(() => {
    if (!open) return;
    let active = true;
    setConversation(null);
    setPendingQuestion(null);
    setProgressiveReply(null);
    setDraft('');
    setLoading(true);
    setError(null);
    void loadPrivateReaderConversation({ projectId, versionId, reader })
      .then((loaded) => {
        if (active) setConversation(loaded);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Conversation could not be opened.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, projectId, reader, versionId]);

  useEffect(() => {
    if (open && !loading) composerRef.current?.focus();
  }, [loading, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!progressiveReply || progressiveReply.visibleTokens >= progressiveReply.tokens.length)
      return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setProgressiveReply((current) =>
        current ? { ...current, visibleTokens: current.tokens.length } : current,
      );
      return;
    }
    const timeout = window.setTimeout(() => {
      setProgressiveReply((current) => {
        if (!current) return current;
        return {
          ...current,
          visibleTokens: Math.min(current.visibleTokens + 1, current.tokens.length),
        };
      });
    }, REVEAL_INTERVAL_MS);
    return () => window.clearTimeout(timeout);
  }, [progressiveReply]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [conversation?.messages.length, pendingQuestion, progressiveReply?.visibleTokens, sending]);

  function beginProgressiveReply(updated: PrivateReaderConversation) {
    const newestReaderMessage = [...updated.messages]
      .reverse()
      .find((message) => message.role === 'reader');
    if (!newestReaderMessage) {
      setProgressiveReply(null);
      return;
    }
    setProgressiveReply({
      messageId: newestReaderMessage.id,
      tokens: responseTokens(newestReaderMessage.text),
      visibleTokens: 0,
    });
  }

  function refocusComposer() {
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || sending) return;
    setSending(true);
    setError(null);
    setPendingQuestion(question);
    setDraft('');
    setProgressiveReply(null);
    try {
      const request = sendPrivateReaderMessage({
        projectId,
        versionId,
        reader,
        message: question,
        sealedReport: report,
        modelChoice,
      });
      const minimumThinkingTime =
        mode === 'local_review'
          ? new Promise<void>((resolve) => window.setTimeout(resolve, LOCAL_THINKING_DELAY_MS))
          : Promise.resolve();
      const [updated] = await Promise.all([request, minimumThinkingTime]);
      setConversation(updated);
      setPendingQuestion(null);
      beginProgressiveReply(updated);
    } catch (reason) {
      setDraft(question);
      setPendingQuestion(null);
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
      refocusComposer();
    }
  }

  async function handleDeepReview(question: string) {
    if (!question.trim() || sending || mode === 'not_activated') return;
    setSending(true);
    setError(null);
    setProgressiveReply(null);
    try {
      const updated = await sendPrivateReaderMessage({
        projectId,
        versionId,
        reader,
        message: question,
        sealedReport: report,
        modelChoice: 'fable',
        deepReview: true,
      });
      setConversation(updated);
      beginProgressiveReply(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Deep review could not be requested.');
    } finally {
      setSending(false);
      refocusComposer();
    }
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function finishProgressiveReply() {
    setProgressiveReply((current) =>
      current ? { ...current, visibleTokens: current.tokens.length } : current,
    );
    refocusComposer();
  }

  function modelName(modelId?: string): string {
    if (modelId?.includes('fable')) return 'Fable 5';
    if (modelId?.includes('opus')) return 'Opus 5';
    return 'Model not recorded';
  }

  function usageSummary(message: PrivateReaderConversation['messages'][number]): string {
    if (message.simulated) return 'No model call or charge';
    const attemptsWithUsage = message.modelAttempts?.filter((attempt) => attempt.usage) ?? [];
    const inputTokens = attemptsWithUsage.length
      ? attemptsWithUsage.reduce((total, attempt) => total + (attempt.usage?.input_tokens ?? 0), 0)
      : message.usage?.input_tokens;
    const outputTokens = attemptsWithUsage.length
      ? attemptsWithUsage.reduce((total, attempt) => total + (attempt.usage?.output_tokens ?? 0), 0)
      : message.usage?.output_tokens;
    const actualCost = attemptsWithUsage.length
      ? attemptsWithUsage.reduce(
          (total, attempt) => total + (attempt.usage?.actual_cost_usd ?? 0),
          0,
        )
      : message.usage?.actual_cost_usd;
    const tokens =
      inputTokens !== undefined || outputTokens !== undefined
        ? `${(inputTokens ?? 0).toLocaleString()} in · ${(outputTokens ?? 0).toLocaleString()} out · `
        : '';
    return actualCost !== undefined
      ? `${tokens}$${actualCost.toFixed(4)}`
      : `${tokens}Cost pending`;
  }

  function auditCost(
    attempts: NonNullable<PrivateReaderConversation['routingAudits']>[number]['modelAttempts'],
  ): string {
    const recorded = attempts.filter((attempt) => attempt.usage?.actual_cost_usd !== undefined);
    if (!recorded.length) return 'Cost unavailable';
    const total = recorded.reduce((sum, attempt) => sum + (attempt.usage?.actual_cost_usd ?? 0), 0);
    return `$${total.toFixed(4)} recorded`;
  }

  if (!open) return null;

  return (
    <aside
      className="reader-conversation reader-conversation--open"
      role="dialog"
      aria-label={`Private conversation with ${readerName}`}
    >
      <header>
        <div className="reader-conversation__identity">
          <img src={readerImage} alt="" />
          <div>
            <span className="dsc-kicker">Talk privately · {readerRole}</span>
            <h3>{readerName}</h3>
          </div>
        </div>
        <button
          type="button"
          className="reader-conversation__back"
          onClick={onClose}
          aria-label={`View ${readerFirstName}’s sealed report`}
        >
          <span aria-hidden="true">←</span>
          View report
        </button>
      </header>

      <div className="reader-conversation__provenance">
        <span>Bound to this screenplay version</span>
        <span>Original report stays sealed</span>
        <span>Conversation saved</span>
      </div>

      <section className="reader-model-router" aria-label="Reader Chat model">
        <div>
          <span className="dsc-kicker">Lemon Model Router</span>
          <strong>Choose how deeply this reader should think</strong>
          <small>
            {modelChoice === 'auto'
              ? 'Auto starts with Opus 5 and uses Fable only after an objective safe failure.'
              : modelChoice === 'opus'
                ? 'Opus 5 answers directly at high effort with no model escalation.'
                : 'Fable 5 performs the deepest review directly at high effort.'}
          </small>
        </div>
        <div className="reader-model-router__choices" role="group" aria-label="Model selection">
          {(
            [
              ['auto', 'Auto', 'Recommended'],
              ['opus', 'Opus 5', 'Direct'],
              ['fable', 'Fable 5', 'Deepest'],
            ] as const
          ).map(([value, label, detail]) => (
            <button
              key={value}
              type="button"
              className={modelChoice === value ? 'is-active' : ''}
              aria-pressed={modelChoice === value}
              onClick={() => setModelChoice(value)}
            >
              <span>{label}</span>
              <small>{detail}</small>
            </button>
          ))}
        </div>
      </section>

      {mode === 'local_review' && (
        <div className="reader-conversation__notice" role="status">
          Local review mode. You can test writing, saved history, citations, and status changes. No
          model call or charge occurs.
        </div>
      )}
      {mode === 'not_activated' && (
        <div className="reader-conversation__notice" role="status">
          Private Reader Chat is prepared but not activated. The sealed reader report remains
          available above.
        </div>
      )}
      {conversation?.routingAudits?.[0] && (
        <div className="reader-conversation__routing-audit" role="status">
          <strong>Previous model attempt stopped safely</strong>
          <span>{conversation.routingAudits[0].routeLabel || 'Reader Chat route recorded'}</span>
          <span>
            {conversation.routingAudits[0].modelAttempts.length} attempt
            {conversation.routingAudits[0].modelAttempts.length === 1 ? '' : 's'}
            {' · '}
            {auditCost(conversation.routingAudits[0].modelAttempts)}
          </span>
        </div>
      )}

      <div ref={transcriptRef} className="reader-conversation__transcript" aria-busy={sending}>
        {loading ? (
          <p className="reader-conversation__empty">Opening your saved private conversation…</p>
        ) : conversation?.messages.length ? (
          conversation.messages.map((message, messageIndex) => {
            const priorQuestion = conversation.messages
              .slice(0, messageIndex)
              .reverse()
              .find((candidate) => candidate.role === 'producer')?.text;
            const canDeepReview =
              message.role === 'reader' &&
              !message.modelId?.includes('fable') &&
              Boolean(priorQuestion);
            const isRevealing =
              progressiveReply?.messageId === message.id &&
              progressiveReply.visibleTokens < progressiveReply.tokens.length;
            const visibleText =
              progressiveReply?.messageId === message.id
                ? progressiveReply.tokens.slice(0, progressiveReply.visibleTokens).join('')
                : message.text;
            const revealComplete = !isRevealing;
            return (
              <article
                key={message.id}
                className={`reader-message reader-message--${message.role}`}
              >
                <div className="reader-message__speaker">
                  {message.role === 'reader' ? (
                    <img src={readerImage} alt="" />
                  ) : (
                    <span aria-hidden="true">BR</span>
                  )}
                  <strong>{message.role === 'reader' ? readerName : 'You'}</strong>
                  {message.position && (
                    <span className={`reader-position reader-position--${message.position}`}>
                      {message.position === 'reconsidered'
                        ? 'Position reconsidered'
                        : message.position}
                    </span>
                  )}
                </div>
                <div className="reader-message__bubble" aria-live={isRevealing ? 'off' : undefined}>
                  {responseParagraphs(visibleText).map((paragraph, index) => (
                    <p key={`${message.id}-paragraph-${index}`}>{paragraph}</p>
                  ))}
                  {isRevealing && <span className="reader-message__cursor" aria-hidden="true" />}
                </div>
                {isRevealing && (
                  <button
                    type="button"
                    className="reader-message__finish-reveal"
                    onClick={finishProgressiveReply}
                  >
                    Show full response
                  </button>
                )}
                {message.role === 'reader' && message.modelId && revealComplete && (
                  <div className="reader-message__model" aria-label="Response provenance">
                    <strong>
                      {message.simulated ? 'Preview route' : 'Answered with'}{' '}
                      {modelName(message.modelId)} · {message.effort || 'high'} effort
                    </strong>
                    <span>{message.routeLabel || 'Model route recorded'}</span>
                    {message.fallbackFrom && (
                      <span>Fallback from {modelName(message.fallbackFrom)}</span>
                    )}
                    <span>
                      {message.modelAttempts?.length || 1} model attempt
                      {(message.modelAttempts?.length || 1) === 1 ? '' : 's'}
                      {' · '}
                      {usageSummary(message)}
                    </span>
                  </div>
                )}
                {message.citations.length > 0 && revealComplete && (
                  <div className="reader-message__citations" aria-label="Screenplay citations">
                    {message.citations.map((citation, index) => (
                      <span key={`${message.id}-${citation.page}-${index}`} title={citation.note}>
                        p. {citation.page}
                      </span>
                    ))}
                  </div>
                )}
                {message.reconsideredPosition && revealComplete && (
                  <section className="reader-message__reconsidered">
                    <strong>What changed</strong>
                    <p>{message.reconsideredPosition.summary}</p>
                    {message.reconsideredPosition.suggestedScore !== undefined && (
                      <span>
                        New private view: {message.reconsideredPosition.suggestedScore.toFixed(1)}
                      </span>
                    )}
                    <small>The sealed score above has not changed.</small>
                  </section>
                )}
                {canDeepReview && revealComplete && (
                  <button
                    type="button"
                    className="reader-message__deep-review"
                    onClick={() => void handleDeepReview(priorQuestion || '')}
                    disabled={sending || mode === 'not_activated'}
                  >
                    Get Fable 5’s deeper second opinion
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <div className="reader-conversation__opening">
            <img src={readerImage} alt="" />
            <div>
              <span>{readerName}</span>
              <p>
                {report.oneSentenceVerdict ||
                  'My sealed report is open. What would you like to challenge or explore?'}
              </p>
            </div>
          </div>
        )}
        {pendingQuestion && (
          <article className="reader-message reader-message--producer reader-message--pending">
            <div className="reader-message__speaker">
              <span aria-hidden="true">BR</span>
              <strong>You</strong>
              <span className="reader-message__sent">Sent</span>
            </div>
            <div className="reader-message__bubble">
              {responseParagraphs(pendingQuestion).map((paragraph, index) => (
                <p key={`pending-question-${index}`}>{paragraph}</p>
              ))}
            </div>
          </article>
        )}
        {sending && (
          <article
            className="reader-message reader-message--reader reader-message--thinking"
            role="status"
            aria-label={`${readerFirstName} is thinking`}
          >
            <div className="reader-message__speaker">
              <img src={readerImage} alt="" />
              <strong>{readerName}</strong>
            </div>
            <div className="reader-message__bubble">
              <span>{readerFirstName} is considering your question</span>
              <span className="reader-typing-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
          </article>
        )}
        {progressiveReply && progressiveReply.visibleTokens >= progressiveReply.tokens.length && (
          <span className="sr-only" role="status">
            {readerFirstName} finished answering.
          </span>
        )}
      </div>

      {error && (
        <div className="reader-conversation__error" role="alert">
          {error}
        </div>
      )}

      <form
        className="reader-conversation__composer"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <label htmlFor={`reader-message-${reader}`}>
          Ask {readerName.split(' ')[0]} anything about this screenplay
        </label>
        <div>
          <textarea
            id={`reader-message-${reader}`}
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Why didn’t the comedy work for you? What would change your mind?"
            rows={2}
            maxLength={4_000}
            disabled={mode === 'not_activated' || sending}
          />
          <button type="submit" disabled={!draft.trim() || sending || mode === 'not_activated'}>
            {sending ? `${readerFirstName} is thinking…` : 'Send'}
          </button>
        </div>
        <small>
          <kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line · Answers
          cite the stored screenplay.
        </small>
      </form>
    </aside>
  );
}
