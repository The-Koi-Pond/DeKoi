import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  appendRoleplayEntries,
  createNarrationRoleplayEntry,
  createPersonaRoleplayEntry,
  deleteRoleplayEntry,
  updateRoleplayEntryBody,
} from "../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayEntry } from "../../../engine/contracts/types/roleplay";
import { getProviderConnectionById } from "../../../engine/contracts/types/provider-connection";
import { ROLEPLAY } from "../../../engine/contracts/constants/surfaces";
import {
  describeGenerationFailureNotice,
  describeGenerationReadinessFailure,
  generateRoleplayThreadTurn,
  getGenerationConnectionReadiness,
  getGenerationModeForConnection,
  selectGenerationRuntime,
} from "../../runtime";
import type {
  NavCatalogState,
  NavLoreRuntimeActions,
  NavRoleplayThreadActions,
  NavSettingsState,
  NavStorageState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import {
  ChatComposer,
  GenerationNotice,
  getGenerationNoticeAction,
  type GenerationNoticeAction,
} from "../shared";
import { getMessageDateTimeTitle, getMessageTimeLabel } from "../shared/message-time";
import { getInitials, isOwnRoleplayEntry } from "./lib/message-view";
import {
  getRoleplayThreadReferenceNotices,
  getRoleplayThreadReferenceSummary,
  getRoleplayThreadSendBlocker,
} from "./lib/thread-reference-summary";
import "./roleplay-thread.css";

export type RoleplayThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavRoleplayThreadActions, "createRoleplayThread" | "updateRoleplayThread"> &
  Pick<NavLoreRuntimeActions, "getLoreRuntimeState" | "updateLoreRuntimeState"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavStorageState, "storageReady"> &
  Pick<NavThreadState, "roleplayThreads"> &
  Pick<NavViewActions, "setSelectedSurface" | "setSideRailView" | "setView"> &
  Pick<NavViewState, "view">;

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface RoleplayThreadProps {
  nav: RoleplayThreadNav;
  onOpenSideRail?: () => void;
}

function RoleplayChatSettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="roleplay-chat-settings-button"
      title="Thread settings"
      aria-label="Open Roleplay thread settings"
      onClick={onClick}
    >
      <span aria-hidden="true">⚙</span>
    </button>
  );
}

export function RoleplayThread({ nav, onOpenSideRail }: RoleplayThreadProps) {
  const activeThreadId = nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const thread = nav.roleplayThreads.find((candidate) => candidate.id === activeThreadId) ?? null;
  const [draftState, setDraftState] = useState<{
    threadId: string | null;
    body: string;
  }>({ threadId: null, body: "" });
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "warning" | "error";
    message: string;
    action: GenerationNoticeAction | null;
  }>({ threadId: null, status: "idle", message: "", action: null });
  const [editingEntry, setEditingEntry] = useState<{
    threadId: string;
    id: string;
    body: string;
  } | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<{
    threadId: string;
    id: string;
    label: string;
  } | null>(null);
  const entryListRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement>(null);
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const threadConnection = getProviderConnectionById(
    thread?.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const generationMode = getGenerationModeForConnection(threadConnection);
  const generationRuntime = selectGenerationRuntime(generationMode);
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
  const threadReferenceSummary = thread
    ? getRoleplayThreadReferenceSummary({
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread,
      })
    : null;
  const threadReferenceNotices = threadReferenceSummary
    ? getRoleplayThreadReferenceNotices(threadReferenceSummary)
    : [];
  const storageBlocker = nav.storageReady ? "" : "Storage is still loading.";
  const sendBlocker =
    storageBlocker ||
    (threadReferenceSummary ? getRoleplayThreadSendBlocker(threadReferenceSummary) : "");
  const canSend =
    !!thread && nav.storageReady && draft.trim().length > 0 && !isGenerating && !sendBlocker;
  const activeEditingEntry = editingEntry?.threadId === activeThreadId ? editingEntry : null;
  const activeDeleteRequest =
    nav.appSettings.confirmRelease && deleteRequest?.threadId === activeThreadId
      ? deleteRequest
      : null;
  const activeEntryInteractionMode = activeDeleteRequest
    ? "delete"
    : activeEditingEntry
      ? "edit"
      : "idle";

  useEffect(() => {
    if (!entryListRef.current) return;
    if (!thread) return;
    entryListRef.current.scrollTop = entryListRef.current.scrollHeight;
  }, [thread, thread?.entries.length]);

  useEffect(() => {
    if (activeEntryInteractionMode !== "edit") return;
    const textarea = editTextareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [activeEditingEntry?.id, activeEntryInteractionMode]);

  useEffect(() => {
    if (activeEntryInteractionMode !== "delete") return;
    if (!activeDeleteRequest?.id) return;
    deleteConfirmRef.current?.focus();
  }, [activeDeleteRequest?.id, activeEntryInteractionMode]);

  function handleEditEntry(entry: RoleplayEntry) {
    if (!thread) return;
    setDeleteRequest(null);
    setEditingEntry({ threadId: thread.id, id: entry.id, body: entry.body });
  }

  function handleCancelEditEntry() {
    setEditingEntry(null);
  }

  function handleSaveEditedEntry() {
    if (!thread || !activeEditingEntry) return;
    const trimmedBody = activeEditingEntry.body.trim();
    if (!trimmedBody) return;
    const originalEntry =
      thread.entries.find((entry) => entry.id === activeEditingEntry.id) ?? null;
    if (!originalEntry) {
      setEditingEntry(null);
      return;
    }
    if (originalEntry.body === trimmedBody) {
      setEditingEntry(null);
      return;
    }

    nav.updateRoleplayThread(
      updateRoleplayEntryBody(thread, activeEditingEntry.id, trimmedBody, new Date().toISOString()),
    );
    setEditingEntry(null);
  }

  function commitDeleteEntry(entryId: string) {
    if (!thread) return;
    nav.updateRoleplayThread(deleteRoleplayEntry(thread, entryId));
    if (activeEditingEntry?.id === entryId) {
      setEditingEntry(null);
    }
    setDeleteRequest(null);
  }

  function handleDeleteEntry(entry: RoleplayEntry) {
    if (!thread) return;
    if (!thread.entries.some((candidate) => candidate.id === entry.id)) {
      return;
    }

    if (nav.appSettings.confirmRelease) {
      setEditingEntry(null);
      setDeleteRequest({
        threadId: thread.id,
        id: entry.id,
        label: entry.label,
      });
      return;
    }

    commitDeleteEntry(entry.id);
  }

  function handleCancelDeleteEntry() {
    setDeleteRequest(null);
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
    handleCancelDeleteEntry();
  }

  async function sendDraft() {
    if (!thread) return false;
    if (!nav.storageReady) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    const sentAt = new Date().toISOString();
    const commitThread =
      nav.roleplayThreads.find((candidate) => candidate.id === activeThreadId) ?? null;
    if (!commitThread) return false;
    const commitSendBlocker = getRoleplayThreadSendBlocker(
      getRoleplayThreadReferenceSummary({
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
    const sendMode = getGenerationModeForConnection(commitConnection);
    const sendRuntime = selectGenerationRuntime(sendMode);
    const sendPersona = commitThread.activePersonaId
      ? (nav.personas.find((persona) => persona.id === commitThread.activePersonaId) ?? null)
      : null;
    const userEntry = sendPersona
      ? createPersonaRoleplayEntry({
          body: trimmedDraft,
          id: createLocalId("roleplay-entry"),
          now: sentAt,
          persona: sendPersona,
          thread: commitThread,
        })
      : createNarrationRoleplayEntry({
          body: trimmedDraft,
          id: createLocalId("roleplay-entry"),
          now: sentAt,
          thread: commitThread,
        });
    const threadWithUserEntry = appendRoleplayEntries(commitThread, [userEntry]);

    nav.updateRoleplayThread(threadWithUserEntry);
    setDraftState({ body: "", threadId: activeThreadId });
    setGenerationState({
      threadId: commitThread.id,
      status: "generating",
      message: `Generating through ${sendRuntime.label}.`,
      action: null,
    });

    try {
      const result = await generateRoleplayThreadTurn({
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: commitConnection.id,
        lorebooks: nav.lorebooks,
        loreRuntimeState: nav.getLoreRuntimeState("roleplay-thread", threadWithUserEntry.id),
        mode: sendMode,
        now: sentAt,
        parameters: {
          temperature: nav.appSettings.defaultTemperature / 100,
          maxTokens: nav.appSettings.defaultMaxTokens,
          topP: nav.appSettings.defaultTopP / 100,
        },
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: threadWithUserEntry,
      });

      if (result.generatedEntryCount > 0) {
        nav.updateRoleplayThread(result.thread);
      }
      nav.updateLoreRuntimeState(
        result.loreRuntimeState,
        "roleplay-thread",
        threadWithUserEntry.id,
      );

      setGenerationState(
        result.generatedEntryCount > 0
          ? {
              threadId: commitThread.id,
              status: result.warnings.length > 0 ? "warning" : "idle",
              message: result.warnings[0] ?? "",
              action: null,
            }
          : (() => {
              const notice = describeGenerationFailureNotice(
                result.warnings[0] ?? "",
                `${sendRuntime.label} did not return a Roleplay reply.`,
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
      const notice = describeGenerationFailureNotice(error, "Roleplay generation failed.");
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

  function openRoleplayThreadSettings() {
    nav.setSelectedSurface(ROLEPLAY);
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
      nav.appSettings.sendOnEnterSurface !== ROLEPLAY
    ) {
      return;
    }

    event.preventDefault();
    void sendDraft();
  }

  function getEntryAuthorAvatar(entry: RoleplayEntry) {
    if (entry.role === "character" && entry.characterId) {
      const character =
        nav.characters.find((candidate) => candidate.id === entry.characterId) ?? null;
      return {
        avatarUrl: character?.avatarUrl ?? null,
        initials: getInitials(character?.displayName ?? entry.label),
      };
    }

    if (entry.role === "persona" && entry.personaId) {
      const persona = nav.personas.find((candidate) => candidate.id === entry.personaId) ?? null;
      return {
        avatarUrl: persona?.avatarUrl ?? null,
        initials: getInitials(persona?.displayName ?? entry.label),
      };
    }

    return {
      avatarUrl: null,
      initials: getInitials(entry.label),
    };
  }

  if (!thread) {
    return (
      <section className="roleplay-thread roleplay-thread-empty">
        <header className="roleplay-header">
          <div className="roleplay-header-icons">
            <RoleplayChatSettingsButton onClick={openRoleplayThreadSettings} />
          </div>
        </header>
        <div className="roleplay-empty">
          <button type="button" onClick={() => nav.createRoleplayThread()}>
            + Start a Roleplay chat
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="roleplay-thread" aria-label="Roleplay thread">
      <header className="roleplay-header">
        <div className="roleplay-header-icons">
          <RoleplayChatSettingsButton onClick={openRoleplayThreadSettings} />
        </div>
      </header>

      {threadReferenceNotices.length > 0 && (
        <div className="roleplay-thread-notices" aria-label="Roleplay thread notices">
          {threadReferenceNotices.map((notice) => (
            <div
              className={`roleplay-thread-notice ${notice.tone}`}
              key={notice.id}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              <p>{notice.message}</p>
              <button
                type="button"
                aria-label={`Open settings for ${notice.id}`}
                onClick={openRoleplayThreadSettings}
              >
                Open settings
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="roleplay-entries" aria-label="Roleplay chat messages" ref={entryListRef}>
        {thread.entries.map((entry) => {
          const isEditing = activeEditingEntry?.id === entry.id;
          const isConfirmingDelete = activeDeleteRequest?.id === entry.id;
          const deleteRequestLabel = isConfirmingDelete
            ? (activeDeleteRequest?.label ?? entry.label)
            : entry.label;
          const authorAvatar = getEntryAuthorAvatar(entry);
          const timeLabel = getMessageTimeLabel(entry.createdAt);

          return (
            <article
              className={`roleplay-entry ${entry.role}${
                isOwnRoleplayEntry(entry) ? " own" : ""
              }${isEditing ? " editing" : ""}${isConfirmingDelete ? " confirming-delete" : ""}`}
              key={entry.id}
            >
              <span className="roleplay-entry-avatar" aria-hidden="true">
                {authorAvatar.avatarUrl ? (
                  <img src={authorAvatar.avatarUrl} alt="" />
                ) : (
                  authorAvatar.initials
                )}
              </span>
              <div className="roleplay-entry-head">
                <div className="roleplay-entry-author">
                  <b>{entry.label}</b>
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
                      aria-label={`Edit Roleplay entry from ${entry.label}`}
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
                        aria-label={`Save edited Roleplay entry from ${entry.label}`}
                        disabled={!activeEditingEntry?.body.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        aria-label={`Cancel editing Roleplay entry from ${entry.label}`}
                        onClick={handleCancelEditEntry}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{entry.body}</p>
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
                            onClick={handleCancelDeleteEntry}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Edit Roleplay entry from ${entry.label}`}
                            title="Edit"
                            onClick={() => handleEditEntry(entry)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete Roleplay entry from ${entry.label}`}
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
            </article>
          );
        })}
        {thread.entries.length === 0 && <p className="roleplay-empty-note">No messages yet.</p>}
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
        ariaLabel="Roleplay composer"
        draftAriaLabel="Draft Roleplay message"
        disabled={!canSend}
        hint={
          generationNotice ||
          sendBlocker ||
          (isGenerating
            ? generationStatusMessage ||
              `${generationRuntime.label} is replying through the provider-neutral path.`
            : nav.appSettings.sendOnEnterSurface === ROLEPLAY
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
        placeholder="Write a Roleplay message..."
        submitBusyLabel="Generating reply"
        submitLabel="Send message"
        value={draft}
      />
    </section>
  );
}
