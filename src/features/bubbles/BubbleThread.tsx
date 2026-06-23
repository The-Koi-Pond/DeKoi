import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNav } from "../../shared/ui/nav-context";
import { type BubbleMessage } from "../../engine/bubbles";
import {
  appendBubbleMessages,
  createPersonaBubbleMessage,
  createPlaceholderCompanionMessage,
  getNextPlaceholderCompanion,
  getPlaceholderReplyText,
} from "../../engine/bubble-actions";
import { sampleCompanions, samplePersona } from "../../engine/sample-bubbles";
import {
  loadBubbleThread,
  resetBubbleThreadStorage,
  saveBubbleThread,
} from "../../runtime/bubble-local-storage";
import "./bubble-thread.css";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMessageClassName(message: BubbleMessage) {
  return message.author.kind === "persona"
    ? "bubble-message bubble-message-own"
    : "bubble-message";
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function BubbleThread() {
  const nav = useNav();
  const [bubbleThread, setBubbleThread] = useState(loadBubbleThread);
  const [draft, setDraft] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);
  const participantSummary = sampleCompanions
    .map((companion) => companion.displayName)
    .join(" + ");
  const canSend = draft.trim().length > 0;

  useEffect(() => {
    saveBubbleThread(bubbleThread);
  }, [bubbleThread]);

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [bubbleThread.messages.length]);

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return;

    const sentAt = new Date().toISOString();
    const userMessage = createPersonaBubbleMessage({
      body: trimmedDraft,
      id: createLocalId("bubble-message"),
      now: sentAt,
      persona: samplePersona,
      thread: bubbleThread,
    });
    const threadWithUserMessage = appendBubbleMessages(
      bubbleThread,
      [userMessage],
      sentAt,
    );
    const placeholderCompanion = getNextPlaceholderCompanion(
      threadWithUserMessage,
      sampleCompanions,
    );

    if (!placeholderCompanion) {
      setBubbleThread(threadWithUserMessage);
      setDraft("");
      return;
    }

    const repliedAt = new Date().toISOString();
    const placeholderReply = createPlaceholderCompanionMessage({
      body: getPlaceholderReplyText(trimmedDraft),
      companion: placeholderCompanion,
      id: createLocalId("bubble-message"),
      now: repliedAt,
      thread: threadWithUserMessage,
    });

    setBubbleThread(
      appendBubbleMessages(
        threadWithUserMessage,
        [placeholderReply],
        repliedAt,
      ),
    );
    setDraft("");
  }

  function handleResetThread() {
    setBubbleThread(resetBubbleThreadStorage());
    setDraft("");
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  return (
    <section className="bubble-thread" aria-labelledby="bubble-thread-title">
      <header className="bubble-header">
        <div>
          <button
            className="bubble-back"
            onClick={handleBack}
            aria-label="Back to the Pond"
          >
            ← Back to the Pond
          </button>
          <h2 id="bubble-thread-title">{bubbleThread.title}</h2>
          <p className="thread-meta">Group Bubble with {participantSummary}</p>
        </div>
        <div className="bubble-header-tools">
          <span className="storage-chip">Saved locally</span>
          <div className="participant-stack" aria-label="Thread participants">
            <span title={samplePersona.displayName}>
              {getInitials(samplePersona.displayName)}
            </span>
            {sampleCompanions.map((companion) => (
              <span title={companion.displayName} key={companion.id}>
                {getInitials(companion.displayName)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div
        className="message-list"
        aria-label="Bubble messages"
        ref={messageListRef}
      >
        {bubbleThread.messages.map((message) => (
          <article className={getMessageClassName(message)} key={message.id}>
            <div className="message-author">
              {message.author.label}
              {message.origin === "placeholder" && <span>Placeholder</span>}
            </div>
            <p>{message.body}</p>
          </article>
        ))}
      </div>

      <form
        className="bubble-composer"
        aria-label="Bubble composer"
        onSubmit={handleSend}
      >
        <textarea
          aria-label="Draft Bubble message"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a Bubble..."
          value={draft}
        />
        <div className="composer-actions">
          <button type="submit" disabled={!canSend}>
            Send
          </button>
          <button
            type="button"
            className="reset-btn"
            onClick={handleResetThread}
            title="Reset thread"
          >
            ↺
          </button>
        </div>
      </form>
    </section>
  );
}
