import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type {
  NavCatalogState,
  NavMessengerThreadActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { type MessengerMessage } from "../../../engine/contracts/types/messenger";
import { getProviderConnectionById } from "../../../engine/contracts/types/provider-connection";
import { MESSENGER } from "../../../engine/contracts/constants/surfaces";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createPersonaMessengerMessage,
  deleteMessengerMessage,
  setMessengerThreadProviderConnection,
  updateMessengerMessageBody,
} from "../../../engine/modes/messenger/messenger-actions";
import {
  describeGenerationFailureNotice,
  describeGenerationReadinessFailure,
  generateMessengerThreadReply,
  getGenerationConnectionReadiness,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime";
import {
  ChatComposer,
  GenerationNotice,
  getGenerationNoticeAction,
  type GenerationNoticeAction,
} from "../shared";
import { waitForGeneratedTypingDelay } from "../shared/generation-delay";
import {
  getMessageDateKey,
  getMessageDateSeparatorLabel,
  getMessageDateTimeTitle,
  getMessageTimeLabel,
} from "../shared/message-time";
import { getInitials, getMessageClassName } from "./lib/message-view";
import {
  getMessengerThreadReferenceNotices,
  getMessengerThreadReferenceSummary,
  getMessengerThreadSendBlocker,
} from "./lib/thread-reference-summary";
import "./messenger-thread.css";

export type MessengerThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavMessengerThreadActions, "createMessengerThread" | "updateMessengerThread"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "messengerThreads"> &
  Pick<NavViewActions, "setSideRailView" | "setView"> &
  Pick<NavViewState, "view">;

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface MessengerThreadProps {
  nav: MessengerThreadNav;
  onOpenSideRail?: () => void;
}

export function MessengerThread({ nav, onOpenSideRail }: MessengerThreadProps) {
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
    action: GenerationNoticeAction | null;
  }>({ threadId: null, status: "idle", message: "", action: null });
  const [editingMessage, setEditingMessage] = useState<{
    threadId: string;
    id: string;
    body: string;
  } | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<{
    threadId: string;
    id: string;
    label: string;
  } | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const threadCompanions = messengerThread
    ? nav.characters.filter((companion) => messengerThread.characterIds.includes(companion.id))
    : [];
  const primaryCompanion = threadCompanions[0] ?? null;
  const companionDisplayName =
    threadCompanions.map((companion) => companion.displayName).join(" + ") ||
    messengerThread?.title ||
    "No companion";
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const isGenerating =
    generationState.threadId === activeThreadId && generationState.status === "generating";
  const visibleGenerationStatus =
    generationState.threadId === activeThreadId ? generationState.status : "idle";
  const generationNotice =
    generationState.threadId === activeThreadId &&
    (generationState.status === "error" || generationState.status === "warning")
      ? generationState.message
      : "";
  const generationStatusMessage =
    generationState.threadId === activeThreadId ? generationState.message : "";
  const generationNoticeAction =
    generationState.threadId === activeThreadId &&
    (generationState.status === "error" || generationState.status === "warning")
      ? generationState.action
      : null;
  const threadReferenceSummary = messengerThread
    ? getMessengerThreadReferenceSummary({
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: messengerThread,
      })
    : null;
  const threadReferenceNotices = threadReferenceSummary
    ? getMessengerThreadReferenceNotices(threadReferenceSummary)
    : [];
  const sendBlocker = threadReferenceSummary
    ? getMessengerThreadSendBlocker(threadReferenceSummary)
    : "";
  const canSend = draft.trim().length > 0 && !isGenerating && !sendBlocker;
  const threadConnection = getProviderConnectionById(
    messengerThread?.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const generationMode = getMessengerGenerationModeForConnection(threadConnection);
  const generationRuntime = selectMessengerGenerationRuntime(generationMode);
  const activeEditingMessage = editingMessage?.threadId === activeThreadId ? editingMessage : null;
  const activeDeleteRequest =
    nav.appSettings.confirmRelease && deleteRequest?.threadId === activeThreadId
      ? deleteRequest
      : null;
  const activeMessageInteractionMode = activeDeleteRequest
    ? "delete"
    : activeEditingMessage
      ? "edit"
      : "idle";
  const getMessageAuthorAvatar = (message: MessengerMessage) => {
    const { author } = message;

    if (author.kind === "persona") {
      const persona = nav.personas.find((candidate) => candidate.id === author.personaId) ?? null;
      return {
        avatarUrl: persona?.avatarUrl ?? null,
        initials: getInitials(persona?.displayName ?? author.label),
      };
    }

    if (author.kind === "character") {
      const character =
        nav.characters.find((candidate) => candidate.id === author.characterId) ?? null;
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

  useEffect(() => {
    if (activeMessageInteractionMode !== "edit") return;
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [activeEditingMessage?.id, activeMessageInteractionMode]);

  useEffect(() => {
    if (activeMessageInteractionMode !== "delete") return;
    if (!activeDeleteRequest?.id) return;
    deleteConfirmRef.current?.focus();
  }, [activeDeleteRequest?.id, activeMessageInteractionMode]);

  function handleEditMessage(message: MessengerMessage) {
    if (!messengerThread) return;
    setDeleteRequest(null);
    setEditingMessage({
      threadId: messengerThread.id,
      id: message.id,
      body: message.body,
    });
  }

  function handleCancelEditMessage() {
    setEditingMessage(null);
  }

  function handleSaveEditedMessage() {
    if (!messengerThread || !activeEditingMessage) return;
    const trimmedBody = activeEditingMessage.body.trim();
    if (!trimmedBody) return;
    const originalMessage =
      messengerThread.messages.find((message) => message.id === activeEditingMessage.id) ?? null;
    if (!originalMessage) {
      setEditingMessage(null);
      return;
    }
    if (originalMessage.body === trimmedBody) {
      setEditingMessage(null);
      return;
    }

    nav.updateMessengerThread(
      updateMessengerMessageBody(
        messengerThread,
        activeEditingMessage.id,
        trimmedBody,
        new Date().toISOString(),
      ),
    );
    setEditingMessage(null);
  }

  function commitDeleteMessage(messageId: string) {
    if (!messengerThread) return;
    nav.updateMessengerThread(deleteMessengerMessage(messengerThread, messageId));
    if (activeEditingMessage?.id === messageId) {
      setEditingMessage(null);
    }
    setDeleteRequest(null);
  }

  function handleDeleteMessage(message: MessengerMessage) {
    if (!messengerThread) return;
    if (!messengerThread.messages.some((candidate) => candidate.id === message.id)) {
      return;
    }

    if (nav.appSettings.confirmRelease) {
      setEditingMessage(null);
      setDeleteRequest({
        threadId: messengerThread.id,
        id: message.id,
        label: message.author.label,
      });
      return;
    }

    commitDeleteMessage(message.id);
  }

  function handleCancelDeleteMessage() {
    setDeleteRequest(null);
  }

  function handleEditMessageKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEditMessage();
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveEditedMessage();
    }
  }

  function handleDeleteConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    handleCancelDeleteMessage();
  }

  async function sendDraft() {
    if (!messengerThread) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    const sentAt = new Date().toISOString();
    const commitThread =
      nav.messengerThreads.find((thread) => thread.id === activeThreadId) ?? null;
    if (!commitThread) return false;
    const commitSendBlocker = getMessengerThreadSendBlocker(
      getMessengerThreadReferenceSummary({
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: commitThread,
      }),
    );
    if (commitSendBlocker) {
      setGenerationState({
        threadId: commitThread.id,
        status: "error",
        message: commitSendBlocker,
        action: null,
      });
      return false;
    }

    const selectedConnection = getProviderConnectionById(
      commitThread.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
      nav.providerConnections,
    );
    const connectionReadiness = getGenerationConnectionReadiness(selectedConnection);
    if (!connectionReadiness.ready) {
      const notice = describeGenerationReadinessFailure(connectionReadiness.code);
      setGenerationState({
        threadId: commitThread.id,
        status: "error",
        message: notice.message,
        action: getGenerationNoticeAction(notice.recoveryTarget, selectedConnection?.id),
      });
      return false;
    }

    const commitConnection = connectionReadiness.connection;
    const sendMode = getMessengerGenerationModeForConnection(commitConnection);
    const sendRuntime = selectMessengerGenerationRuntime(sendMode);
    const sendPersona = commitThread.activePersonaId
      ? (nav.personas.find((persona) => persona.id === commitThread.activePersonaId) ?? null)
      : null;
    const hasConfiguredConnection =
      !!commitThread.providerConnectionId &&
      commitThread.providerConnectionId === commitConnection.id;
    const threadForSend = hasConfiguredConnection
      ? commitThread
      : setMessengerThreadProviderConnection(commitThread, commitConnection.id, sentAt);
    const userMessage = sendPersona
      ? createPersonaMessengerMessage({
          body: trimmedDraft,
          id: createLocalId("messenger-message"),
          now: sentAt,
          persona: sendPersona,
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
      threadId: commitThread.id,
      status: "generating",
      message: `Generating through ${sendRuntime.label}.`,
      action: null,
    });

    try {
      const result = await generateMessengerThreadReply({
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: commitConnection.id,
        lorebooks: nav.lorebooks,
        mode: sendMode,
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
          ...new Set(result.generatedMessages.map((message) => message.author.label)),
        ].join(" + ");
        setGenerationState({
          threadId: commitThread.id,
          status: "generating",
          message: `${typingNames || companionDisplayName} is typing...`,
          action: null,
        });
        await waitForGeneratedTypingDelay(
          result.generatedMessages.map((message) => message.body).join("\n"),
        );
        nav.updateMessengerThread(result.thread);
      }

      setGenerationState(
        result.generatedMessages.length > 0
          ? {
              threadId: commitThread.id,
              status: result.warnings.length > 0 ? "warning" : "idle",
              message: result.warnings[0] ?? "",
              action: null,
            }
          : (() => {
              const notice = describeGenerationFailureNotice(
                result.warnings[0] ?? "",
                `${result.runtimeLabel} did not return a Messenger reply.`,
              );
              return {
                threadId: commitThread.id,
                status: "error" as const,
                message: notice.message,
                action: getGenerationNoticeAction(notice.recoveryTarget, commitConnection.id),
              };
            })(),
      );
    } catch (error) {
      const notice = describeGenerationFailureNotice(error, "Messenger generation failed.");
      setGenerationState({
        threadId: commitThread.id,
        status: "error",
        message: notice.message,
        action: getGenerationNoticeAction(notice.recoveryTarget, commitConnection.id),
      });
    }

    return true;
  }

  function handleSend() {
    void sendDraft();
  }

  function dismissGenerationNotice() {
    setGenerationState({
      threadId: null,
      status: "idle",
      message: "",
      action: null,
    });
  }

  function handleGenerationNoticeAction() {
    const action = generationNoticeAction;
    if (!action) return;

    dismissGenerationNotice();
    onOpenSideRail?.();
    nav.setSideRailView("connections");
    if (action.kind === "create-connection") {
      nav.setView({ kind: "connections", mode: "new" });
      return;
    }

    nav.setView(
      action.connectionId
        ? {
            kind: "connections",
            connectionId: action.connectionId,
          }
        : { kind: "connections" },
    );
  }

  function openMessengerThreadSettings() {
    onOpenSideRail?.();
    nav.setSideRailView("chat-settings");
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
        <div className="messenger-contact-title">
          <h2 id="messenger-contact-name" title={companionDisplayName}>
            {companionDisplayName}
          </h2>
        </div>
        <button
          type="button"
          className="messenger-thread-settings-button"
          aria-label="Open Messenger thread settings"
          title="Thread settings"
          onClick={openMessengerThreadSettings}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      {threadReferenceNotices.length > 0 && (
        <div className="messenger-thread-notices" aria-label="Messenger thread notices">
          {threadReferenceNotices.map((notice) => (
            <div
              className={`messenger-thread-notice ${notice.tone}`}
              key={notice.id}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              <p>{notice.message}</p>
              <button
                type="button"
                aria-label={`Open settings for ${notice.id}`}
                onClick={openMessengerThreadSettings}
              >
                Open settings
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="message-list" aria-label="Messenger messages" ref={messageListRef}>
        {messengerThread.messages.length === 0 && (
          <p className="messenger-empty-note">No messages yet.</p>
        )}
        {messengerThread.messages.map((message, index) => {
          const authorAvatar = getMessageAuthorAvatar(message);
          const dateKey = getMessageDateKey(message.createdAt);
          const previousDateKey =
            index > 0 ? getMessageDateKey(messengerThread.messages[index - 1].createdAt) : "";
          const showDateSeparator = !!dateKey && dateKey !== previousDateKey;
          const isEditing = activeEditingMessage?.id === message.id;
          const isConfirmingDelete = activeDeleteRequest?.id === message.id;
          const deleteRequestLabel = isConfirmingDelete
            ? (activeDeleteRequest?.label ?? message.author.label)
            : message.author.label;
          const timeLabel = getMessageTimeLabel(message.createdAt);

          return (
            <Fragment key={message.id}>
              {showDateSeparator && (
                <div className="message-date-separator">
                  <time dateTime={dateKey}>{getMessageDateSeparatorLabel(message.createdAt)}</time>
                </div>
              )}
              <article
                className={`${getMessageClassName(message)}${isEditing ? " editing" : ""}${
                  isConfirmingDelete ? " confirming-delete" : ""
                }`}
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
                        ref={editTextareaRef}
                        aria-label={`Edit message from ${message.author.label}`}
                        value={activeEditingMessage?.body ?? ""}
                        onKeyDown={handleEditMessageKeyDown}
                        onChange={(event) =>
                          setEditingMessage({
                            threadId: messengerThread.id,
                            id: message.id,
                            body: event.target.value,
                          })
                        }
                      />
                      <div className="message-edit-actions">
                        <button
                          type="button"
                          onClick={handleSaveEditedMessage}
                          aria-label={`Save edited message from ${message.author.label}`}
                          disabled={!activeEditingMessage?.body.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing message from ${message.author.label}`}
                          onClick={handleCancelEditMessage}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{message.body}</p>
                      <div className="message-actions" aria-label="Message actions">
                        {isConfirmingDelete ? (
                          <div
                            className="message-delete-confirm"
                            role="group"
                            aria-label={`Confirm delete message from ${deleteRequestLabel}`}
                            onKeyDown={handleDeleteConfirmKeyDown}
                          >
                            <button
                              ref={deleteConfirmRef}
                              type="button"
                              aria-label={`Confirm delete message from ${deleteRequestLabel}`}
                              onClick={() => commitDeleteMessage(message.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              aria-label={`Cancel delete message from ${deleteRequestLabel}`}
                              onClick={handleCancelDeleteMessage}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
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
                              onClick={() => handleDeleteMessage(message)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </article>
            </Fragment>
          );
        })}
      </div>

      <GenerationNotice
        action={generationNoticeAction}
        fallbackMessage={`${generationRuntime.label} is replying through the provider path.`}
        message={generationStatusMessage}
        onAction={handleGenerationNoticeAction}
        onDismiss={dismissGenerationNotice}
        status={visibleGenerationStatus}
      />

      <ChatComposer
        ariaLabel="Messenger composer"
        draftAriaLabel="Draft Messenger message"
        disabled={!canSend}
        hint={
          generationNotice ||
          sendBlocker ||
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
