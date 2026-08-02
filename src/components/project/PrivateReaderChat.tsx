import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import {
  loadPrivateReaderConversation,
  privateReaderChatMode,
  sendPrivateReaderMessage,
} from '@/lib/privateReaderChat';
import type {
  PrivateReaderConversation,
  PrivateReaderKey,
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
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mode = privateReaderChatMode();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    void loadPrivateReaderConversation({ projectId, versionId, reader })
      .then((loaded) => {
        if (active) setConversation(loaded);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Conversation could not be opened.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const updated = await sendPrivateReaderMessage({
        projectId,
        versionId,
        reader,
        message: draft,
        sealedReport: report,
      });
      setConversation(updated);
      setDraft('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <aside className="reader-conversation reader-conversation--open" role="dialog" aria-label={`Private conversation with ${readerName}`}>
      <header>
        <div className="reader-conversation__identity">
          <img src={readerImage} alt="" />
          <div>
            <span className="dsc-kicker">Talk privately · {readerRole}</span>
            <h3>{readerName}</h3>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close private conversation">×</button>
      </header>

      <div className="reader-conversation__provenance">
        <span>Bound to this screenplay version</span>
        <span>Original report stays sealed</span>
        <span>Conversation saved</span>
      </div>

      {mode === 'local_review' && (
        <div className="reader-conversation__notice" role="status">
          Local review mode. You can test writing, saved history, citations, and status changes. No model call or charge occurs.
        </div>
      )}
      {mode === 'not_activated' && (
        <div className="reader-conversation__notice" role="status">
          Private Reader Chat is prepared but not activated. The sealed reader report remains available above.
        </div>
      )}

      <div className="reader-conversation__transcript" aria-live="polite">
        {loading ? (
          <p className="reader-conversation__empty">Opening your saved private conversation…</p>
        ) : conversation?.messages.length ? (
          conversation.messages.map((message) => (
            <article key={message.id} className={`reader-message reader-message--${message.role}`}>
              <div className="reader-message__speaker">
                {message.role === 'reader' ? <img src={readerImage} alt="" /> : <span aria-hidden="true">BR</span>}
                <strong>{message.role === 'reader' ? readerName : 'You'}</strong>
                {message.position && (
                  <span className={`reader-position reader-position--${message.position}`}>
                    {message.position === 'reconsidered' ? 'Position reconsidered' : message.position}
                  </span>
                )}
              </div>
              <p>{message.text}</p>
              {message.citations.length > 0 && (
                <div className="reader-message__citations" aria-label="Screenplay citations">
                  {message.citations.map((citation, index) => (
                    <span key={`${message.id}-${citation.page}-${index}`} title={citation.note}>
                      p. {citation.page}
                    </span>
                  ))}
                </div>
              )}
              {message.reconsideredPosition && (
                <section className="reader-message__reconsidered">
                  <strong>What changed</strong>
                  <p>{message.reconsideredPosition.summary}</p>
                  {message.reconsideredPosition.suggestedScore !== undefined && (
                    <span>New private view: {message.reconsideredPosition.suggestedScore.toFixed(1)}</span>
                  )}
                  <small>The sealed score above has not changed.</small>
                </section>
              )}
            </article>
          ))
        ) : (
          <div className="reader-conversation__opening">
            <img src={readerImage} alt="" />
            <div>
              <span>{readerName}</span>
              <p>{report.oneSentenceVerdict || 'My sealed report is open. What would you like to challenge or explore?'}</p>
            </div>
          </div>
        )}
      </div>

      {error && <div className="reader-conversation__error" role="alert">{error}</div>}

      <form className="reader-conversation__composer" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor={`reader-message-${reader}`}>Ask {readerName.split(' ')[0]} anything about this screenplay</label>
        <div>
          <textarea
            id={`reader-message-${reader}`}
            ref={composerRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Why didn’t the comedy work for you? What would change your mind?"
            rows={3}
            maxLength={4_000}
            disabled={mode === 'not_activated' || sending}
          />
          <button type="submit" disabled={!draft.trim() || sending || mode === 'not_activated'}>
            {sending ? 'Thinking…' : 'Send privately'}
          </button>
        </div>
        <small>Answers must use the stored screenplay and cite pages. A new opinion never overwrites the original report.</small>
      </form>
    </aside>
  );
}
