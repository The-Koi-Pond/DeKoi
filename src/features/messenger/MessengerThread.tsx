import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNav } from "../../shared/ui/nav-context";
import { type MessengerMessage } from "../../engine/messenger";
import { MESSENGER } from "../../engine/surfaces";
import {
  appendMessengerMessages,
  createPersonaMessengerMessage,
  createPlaceholderCompanionMessage,
  getNextPlaceholderCompanion,
  getPlaceholderReplyText,
} from "../../engine/messenger-actions";
import { sampleCompanions, samplePersona } from "../../engine/sample-messenger";
import "./messenger-thread.css";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMessageClassName(message: MessengerMessage) {
  return message.author.kind === "persona"
    ? "messenger-message messenger-message-own"
    : "messenger-message";
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function MessengerThread() {
  const nav = useNav();
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const messengerThread =
    nav.messengerThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const [draftState, setDraftState] = useState<{
    body: string;
    threadId: string | null;
  }>({ body: "", threadId: null });
  const messageListRef = useRef<HTMLDivElement>(null);
  const threadCompanions = messengerThread
    ? sampleCompanions.filter((companion) =>
        messengerThread.characterIds.includes(companion.id),
      )
    : sampleCompanions;
  const participantSummary = threadCompanions
    .map((companion) => companion.displayName)
    .join(" + ");
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const canSend = draft.trim().length > 0;
  const storageLabel =
    nav.messengerStorageStatus === "saving"
      ? "Saving..."
      : nav.messengerStorageMode === "remote"
        ? "Remote runtime"
        : nav.messengerStorageStatus === "error"
          ? "Local fallback"
          : "Saved locally";

  useEffect(() => {
    if (!messageListRef.current) return;
    if (!messengerThread) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messengerThread, messengerThread?.messages.length]);

  function sendDraft() {
    if (!messengerThread) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;

    const sentAt = new Date().toISOString();
    const userMessage = createPersonaMessengerMessage({
      body: trimmedDraft,
      id: createLocalId("messenger-message"),
      now: sentAt,
      persona: samplePersona,
      thread: messengerThread,
    });
    const threadWithUserMessage = appendMessengerMessages(
      messengerThread,
      [userMessage],
      sentAt,
    );
    const placeholderCompanion = getNextPlaceholderCompanion(
      threadWithUserMessage,
      sampleCompanions,
    );

    if (!placeholderCompanion) {
      nav.updateMessengerThread(threadWithUserMessage);
      setDraftState({ body: "", threadId: activeThreadId });
      return true;
    }

    const repliedAt = new Date().toISOString();
    const placeholderReply = createPlaceholderCompanionMessage({
      body: getPlaceholderReplyText(trimmedDraft),
      companion: placeholderCompanion,
      id: createLocalId("messenger-message"),
      now: repliedAt,
      thread: threadWithUserMessage,
    });

    nav.updateMessengerThread(
      appendMessengerMessages(
        threadWithUserMessage,
        [placeholderReply],
        repliedAt,
      ),
    );
    setDraftState({ body: "", threadId: activeThreadId });
    return true;
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraft();
  }

  function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing ||
      nav.appSettings.sendOnEnterSurface !== MESSENGER
    ) {
      return;
    }

    event.preventDefault();
    sendDraft();
  }

  function handleResetThread() {
    if (!messengerThread) return;
    nav.clearMessengerThreadMessages(messengerThread.id);
    setDraftState({ body: "", threadId: activeThreadId });
  }

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  if (!messengerThread) {
    return (
      <section className="messenger-thread messenger-thread-empty">
        <header className="messenger-header">
          <div>
            <button
              className="messenger-back"
              onClick={handleBack}
              aria-label="Back to the Pond"
            >
              ← Back to the Pond
            </button>
            <h2>No Messenger thread selected</h2>
            <p className="thread-meta">Cast a line to start a local thread.</p>
          </div>
        </header>
        <div className="empty-thread">
          <button type="button" onClick={() => nav.createMessengerThread()}>
            + Cast a line
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="messenger-thread" aria-labelledby="messenger-thread-title">
      <header className="messenger-header">
        <div>
          <button
            className="messenger-back"
            onClick={handleBack}
            aria-label="Back to the Pond"
          >
            ← Back to the Pond
          </button>
          <h2 id="messenger-thread-title">{messengerThread.title}</h2>
          <p className="thread-meta">Group Messenger with {participantSummary}</p>
        </div>
        <div className="messenger-header-tools">
          <span className="storage-chip" title={nav.messengerStorageMessage}>
            {storageLabel}
          </span>
          <div className="participant-stack" aria-label="Thread participants">
            <span title={samplePersona.displayName}>
              {getInitials(samplePersona.displayName)}
            </span>
            {threadCompanions.map((companion) => (
              <span title={companion.displayName} key={companion.id}>
                {getInitials(companion.displayName)}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div
        className="message-list"
        aria-label="Messenger messages"
        ref={messageListRef}
      >
        {messengerThread.messages.map((message) => (
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
        className="messenger-composer"
        aria-label="Messenger composer"
        onSubmit={handleSend}
      >
        <textarea
          aria-label="Draft Messenger message"
          onKeyDown={handleDraftKeyDown}
          onChange={(event) =>
            setDraftState({
              body: event.target.value,
              threadId: activeThreadId,
            })
          }
          placeholder="Write a Messenger message..."
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
        <p className="composer-hint">
          {nav.appSettings.sendOnEnterSurface === MESSENGER
            ? "Enter sends. Shift+Enter adds a new line."
            : "Enter adds a new line. Use Send to release the message."}
        </p>
      </form>
    </section>
  );
}
