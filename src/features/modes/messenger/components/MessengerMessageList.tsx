import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type {
  MessengerModeThread,
  ModeMessage,
} from "../../../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { getActiveModeMessageVersion } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import {
  deleteMessengerMessage,
  updateMessengerMessageBody,
} from "../../../../engine/modes/messenger/messenger-actions";
import { copyTextToClipboard } from "../../../../shared/browser/clipboard";
import {
  getMessageDateKey,
  getMessageDateSeparatorLabel,
  getMessageDateTimeTitle,
  getMessageTimeLabel,
} from "../../shared/message-time";
import {
  getCopyableMessageBody,
  getInitials,
  getMessageAuthorKey,
  getMessageClassName,
} from "../lib/message-view";

interface MessengerMessageListProps {
  characters: CharacterRecord[];
  confirmRelease: boolean;
  isGenerating: boolean;
  messages: ModeMessage[];
  onUpdateThread: (thread: MessengerModeThread) => void;
  personas: PersonaRecord[];
  thread: MessengerModeThread;
}

interface EditingMessage {
  body: string;
  id: string;
  threadId: string;
}

interface DeleteRequest {
  id: string;
  label: string;
  threadId: string;
}

/** Consecutive same-author messages within this window share one header. */
const MESSENGER_GROUP_WINDOW_MS = 5 * 60 * 1000;

/** DESIGN.md §8 Messenger: pending turns reserve space for a quiet jade shimmer row. */
function MessengerPendingRow() {
  return (
    <div className="messenger-pending-row" role="status" aria-live="polite">
      <span className="messenger-pending-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="messenger-pending-label">Generating…</span>
    </div>
  );
}

export function MessengerMessageList({
  characters,
  confirmRelease,
  isGenerating,
  messages,
  onUpdateThread,
  personas,
  thread,
}: MessengerMessageListProps) {
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const activeEditingMessage = editingMessage?.threadId === thread.id ? editingMessage : null;
  const activeDeleteRequest =
    confirmRelease && deleteRequest?.threadId === thread.id ? deleteRequest : null;
  const activeInteractionMode = activeDeleteRequest
    ? "delete"
    : activeEditingMessage
      ? "edit"
      : "idle";

  useEffect(() => {
    if (!messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [thread, thread.messages.length]);

  useEffect(() => {
    if (activeInteractionMode !== "edit") return;
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [activeEditingMessage?.id, activeInteractionMode]);

  useEffect(() => {
    if (activeInteractionMode !== "delete") return;
    if (!activeDeleteRequest?.id) return;
    deleteConfirmRef.current?.focus();
  }, [activeDeleteRequest?.id, activeInteractionMode]);

  function getMessageAuthorAvatar(message: ModeMessage) {
    const { author } = message;

    if (author.kind === "persona") {
      const persona = personas.find((candidate) => candidate.id === author.personaId) ?? null;
      return {
        avatarUrl: persona?.avatarUrl ?? null,
        initials: getInitials(persona?.displayName ?? author.label),
      };
    }

    if (author.kind === "character") {
      const character = characters.find((candidate) => candidate.id === author.characterId) ?? null;
      return {
        avatarUrl: character?.avatarUrl ?? null,
        initials: getInitials(character?.displayName ?? author.label),
      };
    }

    return {
      avatarUrl: null,
      initials: getInitials(author.label),
    };
  }

  function handleEditMessage(message: ModeMessage) {
    setDeleteRequest(null);
    setEditingMessage({
      threadId: thread.id,
      id: message.id,
      body: getActiveModeMessageVersion(message).body,
    });
  }

  function handleCancelEditMessage() {
    setEditingMessage(null);
  }

  function handleSaveEditedMessage() {
    if (!activeEditingMessage) return;
    const trimmedBody = activeEditingMessage.body.trim();
    if (!trimmedBody) return;
    const originalMessage =
      messages.find((message) => message.id === activeEditingMessage.id) ?? null;
    if (!originalMessage) {
      setEditingMessage(null);
      return;
    }
    if (getActiveModeMessageVersion(originalMessage).body === trimmedBody) {
      setEditingMessage(null);
      return;
    }

    onUpdateThread(
      updateMessengerMessageBody(
        thread,
        activeEditingMessage.id,
        trimmedBody,
        new Date().toISOString(),
      ),
    );
    setEditingMessage(null);
  }

  function commitDeleteMessage(messageId: string) {
    onUpdateThread(deleteMessengerMessage(thread, messageId));
    if (activeEditingMessage?.id === messageId) {
      setEditingMessage(null);
    }
    setDeleteRequest(null);
  }

  function handleDeleteMessage(message: ModeMessage) {
    if (!messages.some((candidate) => candidate.id === message.id)) return;

    if (confirmRelease) {
      setEditingMessage(null);
      setDeleteRequest({
        threadId: thread.id,
        id: message.id,
        label: message.author.label,
      });
      return;
    }

    commitDeleteMessage(message.id);
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
    setDeleteRequest(null);
  }

  function handleCopyMessage(message: ModeMessage) {
    const body = getCopyableMessageBody(message);
    if (!body) return;
    void copyTextToClipboard(body);
  }

  return (
    <div className="message-list" aria-label="Messenger messages" ref={messageListRef}>
      {messages.length === 0 && !isGenerating && (
        <p className="messenger-empty-note">No messages yet.</p>
      )}
      {messages.map((message, index) => {
        const messageVersion = getActiveModeMessageVersion(message);
        const messageBody = messageVersion.body;
        const authorAvatar = getMessageAuthorAvatar(message);
        const dateKey = getMessageDateKey(message.createdAt);
        const previousDateKey = index > 0 ? getMessageDateKey(messages[index - 1].createdAt) : "";
        const showDateSeparator = !!dateKey && dateKey !== previousDateKey;
        const isEditing = activeEditingMessage?.id === message.id;
        const isConfirmingDelete = activeDeleteRequest?.id === message.id;
        const deleteRequestLabel = isConfirmingDelete
          ? (activeDeleteRequest?.label ?? message.author.label)
          : message.author.label;
        const timeLabel = getMessageTimeLabel(message.createdAt);
        const previousMessage = index > 0 ? messages[index - 1] : null;
        const previousTime = previousMessage ? Date.parse(previousMessage.createdAt) : NaN;
        const currentTime = Date.parse(message.createdAt);
        const opensGroup =
          !previousMessage ||
          showDateSeparator ||
          getMessageAuthorKey(previousMessage) !== getMessageAuthorKey(message) ||
          Number.isNaN(previousTime) ||
          Number.isNaN(currentTime) ||
          currentTime - previousTime > MESSENGER_GROUP_WINDOW_MS;

        return (
          <Fragment key={message.id}>
            {showDateSeparator && (
              <div className="message-date-separator">
                <time dateTime={dateKey}>{getMessageDateSeparatorLabel(message.createdAt)}</time>
              </div>
            )}
            <article
              className={`${getMessageClassName(message)}${
                opensGroup ? " group-head" : " group-continuation"
              }${isEditing ? " editing" : ""}${isConfirmingDelete ? " confirming-delete" : ""}`}
            >
              <span className="message-avatar" aria-hidden="true">
                {opensGroup &&
                  (authorAvatar.avatarUrl ? (
                    <img src={authorAvatar.avatarUrl} alt="" />
                  ) : (
                    authorAvatar.initials
                  ))}
              </span>
              <div className="message-content">
                {opensGroup ? (
                  <div className="message-heading">
                    <div className="message-author">
                      <span className="message-author-name">{message.author.label}</span>
                      {timeLabel && (
                        <time
                          className="message-timestamp"
                          dateTime={message.createdAt}
                          title={getMessageDateTimeTitle(message.createdAt)}
                        >
                          {timeLabel}
                        </time>
                      )}
                    </div>
                  </div>
                ) : (
                  timeLabel && (
                    <time
                      className="message-hover-timestamp"
                      dateTime={message.createdAt}
                      title={getMessageDateTimeTitle(message.createdAt)}
                    >
                      {timeLabel}
                    </time>
                  )
                )}
                {isEditing ? (
                  <div className="message-edit-form">
                    <textarea
                      ref={editTextareaRef}
                      aria-label={`Edit message from ${message.author.label}`}
                      value={activeEditingMessage?.body ?? ""}
                      onKeyDown={handleEditMessageKeyDown}
                      onChange={(event) =>
                        setEditingMessage({
                          threadId: thread.id,
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
                    <p>{messageBody}</p>
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
                            onClick={() => setDeleteRequest(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="message-action-pill"
                            aria-label={`Copy message from ${message.author.label}`}
                            title="Copy"
                            onClick={() => handleCopyMessage(message)}
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            className="message-action-pill"
                            aria-label={`Edit message from ${message.author.label}`}
                            title="Edit"
                            onClick={() => handleEditMessage(message)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="message-action-pill"
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
      {isGenerating && <MessengerPendingRow />}
    </div>
  );
}
