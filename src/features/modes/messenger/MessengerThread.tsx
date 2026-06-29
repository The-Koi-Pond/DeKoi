import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type {
  NavCatalogState,
  NavMessengerThreadActions,
  NavSettingsState,
  NavThreadState,
  NavViewState,
} from "../../navigation";
import { type MessengerMessage } from "../../../engine/messenger";
import { getProviderConnectionById } from "../../../engine/provider-connection";
import { MESSENGER } from "../../../engine/surfaces";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createPersonaMessengerMessage,
  deleteMessengerMessage,
  setMessengerThreadProviderConnection,
  updateMessengerMessageBody,
} from "../../../engine/messenger-actions";
import {
  generateMessengerThreadReply,
  formatGenerationFailureNotice,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime";
import { ChatComposer } from "../shared";
import { waitForGeneratedTypingDelay } from "../shared/generation-delay";
import {
  getMessageDateKey,
  getMessageDateSeparatorLabel,
  getMessageDateTimeTitle,
  getMessageTimeLabel,
} from "../shared/message-time";
import "./messenger-thread.css";

export type MessengerThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavMessengerThreadActions, "createMessengerThread" | "updateMessengerThread"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "messengerThreads"> &
  Pick<NavViewState, "view">;

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getMessageClassName(message: MessengerMessage) {
  return message.author.kind === "persona" ||
    (message.author.kind === "unknown" && message.author.label === "Anonymous")
    ? "messenger-message messenger-message-own"
    : "messenger-message";
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface MessengerThreadProps {
  nav: MessengerThreadNav;
}

export function MessengerThread({ nav }: MessengerThreadProps) {
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const messengerThread =
    nav.messengerThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const [draftState, setDraftState] = useState<{
    body: string;
    threadId: string | null;
  }>({ body: "", threadId: null });
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "warning" | "error";
    message: string;
  }>({ threadId: null, status: "idle", message: "" });
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const activePersona = messengerThread?.activePersonaId
    ? nav.personas.find(
        (persona) => persona.id === messengerThread.activePersonaId,
      ) ?? null
    : null;
  const threadCompanions = messengerThread
    ? nav.characters.filter((companion) =>
        messengerThread.characterIds.includes(companion.id),
      )
    : [];
  const primaryCompanion = threadCompanions[0] ?? null;
  const companionDisplayName =
    threadCompanions.map((companion) => companion.displayName).join(" + ") ||
    messengerThread?.title ||
    "No companion";
  const configuredConnection = messengerThread?.providerConnectionId
    ? nav.providerConnections.find(
        (connection) => connection.id === messengerThread.providerConnectionId,
      ) ?? null
    : null;
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const isGenerating =
    generationState.threadId === activeThreadId &&
    generationState.status === "generating";
  const visibleGenerationStatus =
    generationState.threadId === activeThreadId ? generationState.status : "idle";
  const generationNotice =
    generationState.threadId === activeThreadId &&
    (generationState.status === "error" || generationState.status === "warning")
      ? generationState.message
      : "";
  const generationStatusMessage =
    generationState.threadId === activeThreadId ? generationState.message : "";
  const canSend = draft.trim().length > 0 && !isGenerating;
  const threadConnection = getProviderConnectionById(
    messengerThread?.providerConnectionId ??
      nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const generationMode = getMessengerGenerationModeForConnection(threadConnection);
  const generationRuntime = selectMessengerGenerationRuntime(generationMode);
  const getMessageAuthorAvatar = (message: MessengerMessage) => {
    const { author } = message;

    if (author.kind === "persona") {
      const persona =
        nav.personas.find(
          (candidate) => candidate.id === author.personaId,
        ) ?? null;
      return {
        avatarUrl: persona?.avatarUrl ?? null,
        initials: getInitials(persona?.displayName ?? author.label),
      };
    }

    if (author.kind === "character") {
      const character =
        nav.characters.find(
          (candidate) => candidate.id === author.characterId,
        ) ?? null;
      return {
        avatarUrl: character?.avatarUrl ?? null,
        initials: getInitials(character?.displayName ?? author.label),
      };
    }

    return {
      avatarUrl: null,
      initials: getInitials(author.label),
    };
  };

  useEffect(() => {
    if (!messageListRef.current) return;
    if (!messengerThread) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messengerThread, messengerThread?.messages.length]);

  function handleEditMessage(message: MessengerMessage) {
    setEditingMessage({ id: message.id, body: message.body });
  }

  function handleCancelEditMessage() {
    setEditingMessage(null);
  }

  function handleSaveEditedMessage() {
    if (!messengerThread || !editingMessage) return;
    const trimmedBody = editingMessage.body.trim();
    if (!trimmedBody) return;

    nav.updateMessengerThread(
      updateMessengerMessageBody(
        messengerThread,
        editingMessage.id,
        trimmedBody,
        new Date().toISOString(),
      ),
    );
    setEditingMessage(null);
  }

  function handleDeleteMessage(messageId: string) {
    if (!messengerThread) return;
    nav.updateMessengerThread(deleteMessengerMessage(messengerThread, messageId));
    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
    }
  }

  async function sendDraft() {
    if (!messengerThread) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    if (!threadConnection) {
      setGenerationState({
        threadId: messengerThread.id,
        status: "error",
        message: "Create or select a connection before generating.",
      });
      return false;
    }

    const sentAt = new Date().toISOString();
    const hasConfiguredConnection =
      !!messengerThread.providerConnectionId && configuredConnection !== null;
    const threadForSend = hasConfiguredConnection
      ? messengerThread
      : setMessengerThreadProviderConnection(
          messengerThread,
          threadConnection.id,
          sentAt,
        );
    const userMessage = activePersona
      ? createPersonaMessengerMessage({
          body: trimmedDraft,
          id: createLocalId("messenger-message"),
          now: sentAt,
          persona: activePersona,
          thread: threadForSend,
        })
      : createAnonymousMessengerMessage({
          body: trimmedDraft,
          id: createLocalId("messenger-message"),
          now: sentAt,
          thread: threadForSend,
        });
    const threadWithUserMessage = appendMessengerMessages(threadForSend, [userMessage]);

    nav.updateMessengerThread(threadWithUserMessage);
    setDraftState({ body: "", threadId: activeThreadId });

    setGenerationState({
      threadId: messengerThread.id,
      status: "generating",
      message: `Generating through ${generationRuntime.label}.`,
    });

    try {
      const result = await generateMessengerThreadReply({
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: threadConnection.id,
        lorebooks: nav.lorebooks,
        mode: generationMode,
        now: sentAt,
        parameters: {
          temperature: nav.appSettings.defaultTemperature / 100,
          maxTokens: nav.appSettings.defaultMaxTokens,
          topP: nav.appSettings.defaultTopP / 100,
        },
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: threadWithUserMessage,
        userMessage,
      });

      if (result.generatedMessages.length > 0) {
        const typingNames = [
          ...new Set(
            result.generatedMessages.map((message) => message.author.label),
          ),
        ].join(" + ");
        setGenerationState({
          threadId: messengerThread.id,
          status: "generating",
          message: `${typingNames || companionDisplayName} is typing...`,
        });
        await waitForGeneratedTypingDelay(
          result.generatedMessages.map((message) => message.body).join("\n"),
        );
        nav.updateMessengerThread(result.thread);
      }

      setGenerationState(
        result.generatedMessages.length > 0
          ? {
              threadId: messengerThread.id,
              status: result.warnings.length > 0 ? "warning" : "idle",
              message: result.warnings[0] ?? "",
            }
          : {
              threadId: messengerThread.id,
              status: "error",
              message:
                result.warnings[0] ??
                `${result.runtimeLabel} did not return a Messenger reply.`,
            },
      );
    } catch (error) {
      setGenerationState({
        threadId: messengerThread.id,
        status: "error",
        message: formatGenerationFailureNotice(
          error,
          "Messenger generation failed.",
        ),
      });
    }

    return true;
  }

  function handleSend() {
    void sendDraft();
  }

  function dismissGenerationNotice() {
    setGenerationState({ threadId: null, status: "idle", message: "" });
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
    void sendDraft();
  }

  if (!messengerThread) {
    return (
      <section className="messenger-thread messenger-thread-empty">
        <div className="empty-thread">
          <button type="button" onClick={() => nav.createMessengerThread()}>
            + Cast a line
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="messenger-thread" aria-labelledby="messenger-contact-name">
      <header className="messenger-contact-header">
        <span className="messenger-contact-avatar" aria-hidden="true">
          {primaryCompanion?.avatarUrl ? (
            <img src={primaryCompanion.avatarUrl} alt="" />
          ) : (
            getInitials(companionDisplayName)
          )}
          <span className="messenger-contact-status" />
        </span>
        <h2 id="messenger-contact-name" title={companionDisplayName}>
          {companionDisplayName}
        </h2>
      </header>

      <div
        className="message-list"
        aria-label="Messenger messages"
        ref={messageListRef}
      >
        {messengerThread.messages.map((message, index) => {
          const authorAvatar = getMessageAuthorAvatar(message);
          const dateKey = getMessageDateKey(message.createdAt);
          const previousDateKey =
            index > 0
              ? getMessageDateKey(messengerThread.messages[index - 1].createdAt)
              : "";
          const showDateSeparator = !!dateKey && dateKey !== previousDateKey;
          const isEditing = editingMessage?.id === message.id;
          const timeLabel = getMessageTimeLabel(message.createdAt);

          return (
            <Fragment key={message.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <time dateTime={dateKey}>
                    {getMessageDateSeparatorLabel(message.createdAt)}
                  </time>
                </div>
              )}
              <article
                className={`${getMessageClassName(message)}${isEditing ? " editing" : ""}`}
              >
                <span className="message-avatar" aria-hidden="true">
                  {authorAvatar.avatarUrl ? (
                    <img src={authorAvatar.avatarUrl} alt="" />
                  ) : (
                    authorAvatar.initials
                  )}
                </span>
                <div className="message-content">
                  <div className="message-heading">
                    <div className="message-author">
                      {message.author.label}
                      {timeLabel && (
                        <time
                          className="message-timestamp"
                          dateTime={message.createdAt}
                          title={getMessageDateTimeTitle(message.createdAt)}
                        >
                          {timeLabel}
                        </time>
                      )}
                      {message.origin === "placeholder" && <span>Placeholder</span>}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="message-edit-form">
                      <textarea
                        aria-label={`Edit message from ${message.author.label}`}
                        value={editingMessage.body}
                        onChange={(event) =>
                          setEditingMessage({
                            id: message.id,
                            body: event.target.value,
                          })
                        }
                      />
                      <div className="message-edit-actions">
                        <button
                          type="button"
                          onClick={handleSaveEditedMessage}
                          disabled={!editingMessage.body.trim()}
                        >
                          Save
                        </button>
                        <button type="button" onClick={handleCancelEditMessage}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{message.body}</p>
                      <div className="message-actions" aria-label="Message actions">
                        <button
                          type="button"
                          aria-label={`Edit message from ${message.author.label}`}
                          title="Edit"
                          onClick={() => handleEditMessage(message)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete message from ${message.author.label}`}
                          title="Delete"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          ×
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>

      {visibleGenerationStatus !== "idle" && (
        <div
          className={`thread-generation-notice ${visibleGenerationStatus}`}
          role={visibleGenerationStatus === "error" ? "alert" : "status"}
        >
          <span>
            {generationStatusMessage ||
              `${generationRuntime.label} is replying through the provider path.`}
          </span>
          {(visibleGenerationStatus === "error" ||
            visibleGenerationStatus === "warning") && (
            <button
              type="button"
              aria-label="Dismiss generation message"
              title="Dismiss"
              onClick={dismissGenerationNotice}
            >
              ×
            </button>
          )}
        </div>
      )}

      <ChatComposer
        ariaLabel="Messenger composer"
        draftAriaLabel="Draft Messenger message"
        disabled={!canSend}
        hint={
          generationNotice ||
          (isGenerating
            ? generationStatusMessage ||
              `${generationRuntime.label} is replying through the provider-neutral path.`
            : nav.appSettings.sendOnEnterSurface === MESSENGER
            ? "Enter sends. Shift+Enter adds a new line."
            : "Enter adds a new line. Use Send to release the message.")
        }
        isSubmitting={isGenerating}
        onChange={(value) =>
          setDraftState({
            body: value,
            threadId: activeThreadId,
          })
        }
        onKeyDown={handleDraftKeyDown}
        onSubmit={handleSend}
        placeholder="Write a Messenger message..."
        submitBusyLabel="Generating reply"
        submitLabel="Send message"
        value={draft}
      />
    </section>
  );
}
