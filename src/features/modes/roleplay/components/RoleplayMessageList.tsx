import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from "react";

import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type {
  ModeMessage,
  RoleplayModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { getActiveModeMessageVersion } from "../../../../engine/modes/mode-thread/mode-thread-actions";
import {
  deleteRoleplayMessage,
  updateRoleplayMessageBody,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import { copyTextToClipboard } from "../../../../shared/browser/clipboard";
import { getMessageDateTimeTitle, getMessageTimeLabel } from "../../shared/message-time";
import {
  getCopyableRoleplayMessageBody,
  getInitials,
  isOwnRoleplayMessage,
} from "../lib/message-view";

interface RoleplayMessageListProps {
  characters: CharacterRecord[];
  confirmRelease: boolean;
  generationLabel: string;
  isGenerating: boolean;
  messages: ModeMessage[];
  onUpdateThread: (thread: RoleplayModeThread) => void;
  personas: PersonaRecord[];
  thread: RoleplayModeThread;
}

interface EditingEntry {
  body: string;
  id: string;
  threadId: string;
}

interface DeleteRequest {
  id: string;
  label: string;
  threadId: string;
}

/** DESIGN.md §8: pending turns reserve space for a quiet jade shimmer row. */
function RoleplayPendingRow({ label }: { label: string }) {
  return (
    <div className="roleplay-pending-row" role="status" aria-live="polite">
      <span className="roleplay-pending-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="roleplay-pending-label">{label} is replying…</span>
    </div>
  );
}

export function RoleplayMessageList({
  characters,
  confirmRelease,
  generationLabel,
  isGenerating,
  messages,
  onUpdateThread,
  personas,
  thread,
}: RoleplayMessageListProps) {
  const [editingEntry, setEditingEntry] = useState<EditingEntry | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const entryListRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const activeEditingEntry = editingEntry?.threadId === thread.id ? editingEntry : null;
  const activeDeleteRequest =
    confirmRelease && deleteRequest?.threadId === thread.id ? deleteRequest : null;
  const activeInteractionMode = activeDeleteRequest
    ? "delete"
    : activeEditingEntry
      ? "edit"
      : "idle";

  useEffect(() => {
    if (!entryListRef.current) return;
    entryListRef.current.scrollTop = entryListRef.current.scrollHeight;
  }, [thread, messages.length]);

  useEffect(() => {
    if (activeInteractionMode !== "edit") return;
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [activeEditingEntry?.id, activeInteractionMode]);

  useEffect(() => {
    if (activeInteractionMode !== "delete") return;
    if (!activeDeleteRequest?.id) return;
    deleteConfirmRef.current?.focus();
  }, [activeDeleteRequest?.id, activeInteractionMode]);

  function getEntryAuthorAvatar(entry: ModeMessage) {
    if (entry.author.kind === "character") {
      const characterId = entry.author.characterId;
      const character = characters.find((candidate) => candidate.id === characterId) ?? null;
      return {
        avatarUrl: character?.avatarUrl ?? null,
        initials: getInitials(character?.displayName ?? entry.author.label),
      };
    }

    if (entry.author.kind === "persona") {
      const personaId = entry.author.personaId;
      const persona = personas.find((candidate) => candidate.id === personaId) ?? null;
      return {
        avatarUrl: persona?.avatarUrl ?? null,
        initials: getInitials(persona?.displayName ?? entry.author.label),
      };
    }

    return {
      avatarUrl: null,
      initials: getInitials(entry.author.label),
    };
  }

  function handleEditEntry(entry: ModeMessage) {
    setDeleteRequest(null);
    setEditingEntry({
      threadId: thread.id,
      id: entry.id,
      body: getActiveModeMessageVersion(entry).body,
    });
  }

  function handleCancelEditEntry() {
    setEditingEntry(null);
  }

  function handleSaveEditedEntry() {
    if (!activeEditingEntry) return;
    const trimmedBody = activeEditingEntry.body.trim();
    if (!trimmedBody) return;
    const originalEntry = messages.find((entry) => entry.id === activeEditingEntry.id) ?? null;
    if (!originalEntry) {
      setEditingEntry(null);
      return;
    }
    if (getActiveModeMessageVersion(originalEntry).body === trimmedBody) {
      setEditingEntry(null);
      return;
    }

    onUpdateThread(
      updateRoleplayMessageBody(
        thread,
        activeEditingEntry.id,
        trimmedBody,
        new Date().toISOString(),
      ),
    );
    setEditingEntry(null);
  }

  function commitDeleteEntry(entryId: string) {
    onUpdateThread(deleteRoleplayMessage(thread, entryId));
    if (activeEditingEntry?.id === entryId) {
      setEditingEntry(null);
    }
    setDeleteRequest(null);
  }

  function handleDeleteEntry(entry: ModeMessage) {
    if (!messages.some((candidate) => candidate.id === entry.id)) return;

    if (confirmRelease) {
      setEditingEntry(null);
      setDeleteRequest({
        threadId: thread.id,
        id: entry.id,
        label: entry.author.label,
      });
      return;
    }

    commitDeleteEntry(entry.id);
  }

  function handleEditEntryKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Escape") {
      event.preventDefault();
      handleCancelEditEntry();
      return;
    }

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveEditedEntry();
    }
  }

  function handleDeleteConfirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setDeleteRequest(null);
  }

  function handleCopyEntry(entry: ModeMessage) {
    const body = getCopyableRoleplayMessageBody(entry);
    if (!body) return;
    void copyTextToClipboard(body);
  }

  return (
    <div className="roleplay-messages" aria-label="Roleplay scene" ref={entryListRef}>
      {messages.length === 0 && !isGenerating && (
        <p className="roleplay-empty-note">No messages yet.</p>
      )}
      {messages.map((entry) => {
        const body = getActiveModeMessageVersion(entry).body;
        const label = entry.author.label;
        const isEditing = activeEditingEntry?.id === entry.id;
        const isConfirmingDelete = activeDeleteRequest?.id === entry.id;
        const deleteRequestLabel = isConfirmingDelete
          ? (activeDeleteRequest?.label ?? label)
          : label;
        const authorAvatar = getEntryAuthorAvatar(entry);
        const timeLabel = getMessageTimeLabel(entry.createdAt);
        const own = isOwnRoleplayMessage(entry);
        const speakerChip =
          entry.author.kind === "character"
            ? "Character"
            : entry.author.kind === "persona"
              ? "Persona"
              : "Scene";

        return (
          <Fragment key={entry.id}>
            <article
              className={`roleplay-entry ${entry.author.kind}${own ? " own" : ""}${
                isEditing ? " editing" : ""
              }${isConfirmingDelete ? " confirming-delete" : ""}`}
              aria-label={`${speakerChip} entry from ${label}`}
            >
              <span
                className={`roleplay-entry-avatar ${own ? "persona" : "character"}`}
                aria-hidden="true"
              >
                {authorAvatar.avatarUrl ? (
                  <img src={authorAvatar.avatarUrl} alt="" />
                ) : (
                  authorAvatar.initials
                )}
              </span>
              <div className="roleplay-entry-content">
                <div className="roleplay-entry-head">
                  <div className="roleplay-entry-author">
                    <b>{label}</b>
                    {timeLabel && (
                      <time
                        className="roleplay-entry-timestamp"
                        dateTime={entry.createdAt}
                        title={getMessageDateTimeTitle(entry.createdAt)}
                      >
                        {timeLabel}
                      </time>
                    )}
                  </div>
                </div>
                <div className="roleplay-entry-bubble">
                  {isEditing ? (
                    <div className="roleplay-entry-edit-form">
                      <textarea
                        ref={editTextareaRef}
                        aria-label={`Edit Roleplay entry from ${label}`}
                        value={activeEditingEntry?.body ?? ""}
                        onKeyDown={handleEditEntryKeyDown}
                        onChange={(event) =>
                          setEditingEntry({
                            threadId: thread.id,
                            id: entry.id,
                            body: event.target.value,
                          })
                        }
                      />
                      <div className="roleplay-entry-edit-actions">
                        <button
                          type="button"
                          onClick={handleSaveEditedEntry}
                          aria-label={`Save edited Roleplay entry from ${label}`}
                          disabled={!activeEditingEntry?.body.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing Roleplay entry from ${label}`}
                          onClick={handleCancelEditEntry}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>{body}</p>
                      <div className="roleplay-entry-actions" aria-label="Entry actions">
                        {isConfirmingDelete ? (
                          <div
                            className="roleplay-entry-delete-confirm"
                            role="group"
                            aria-label={`Confirm delete Roleplay entry from ${deleteRequestLabel}`}
                            onKeyDown={handleDeleteConfirmKeyDown}
                          >
                            <button
                              ref={deleteConfirmRef}
                              type="button"
                              aria-label={`Confirm delete Roleplay entry from ${deleteRequestLabel}`}
                              onClick={() => commitDeleteEntry(entry.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              aria-label={`Cancel delete Roleplay entry from ${deleteRequestLabel}`}
                              onClick={() => setDeleteRequest(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Copy Roleplay entry from ${label}`}
                              title="Copy"
                              onClick={() => handleCopyEntry(entry)}
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Edit Roleplay entry from ${label}`}
                              title="Edit"
                              onClick={() => handleEditEntry(entry)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Delete Roleplay entry from ${label}`}
                              title="Delete"
                              onClick={() => handleDeleteEntry(entry)}
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </article>
          </Fragment>
        );
      })}
      {isGenerating && <RoleplayPendingRow label={generationLabel} />}
    </div>
  );
}
