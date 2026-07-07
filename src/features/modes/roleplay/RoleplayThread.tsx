import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
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
import { copyTextToClipboard } from "../../../shared/browser/clipboard";
import {
  describeGenerationFailureNotice,
  describeGenerationReadinessFailure,
  describeGenerationTransport,
  generateRoleplayThreadTurn,
  getGenerationConnectionReadiness,
} from "../../runtime";
import { commitGenerationMacroVariableStates } from "../../../engine/macro-variables/macro-variable-actions";
import type {
  NavCatalogState,
  NavLoreRuntimeActions,
  NavMacroVariableActions,
  NavMacroVariableState,
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
import { generationOriginStillExists } from "../shared/generation-origin";
import { getMessageDateTimeTitle, getMessageTimeLabel } from "../shared/message-time";
import { getCopyableRoleplayEntryBody, getInitials, isOwnRoleplayEntry } from "./lib/message-view";
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
  Pick<NavMacroVariableState, "macroVariableStates"> &
  Pick<NavMacroVariableActions, "updateMacroVariableStates"> &
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

/** DESIGN.md §8: pending turns show a quiet jade shimmer-dot row inside the
 * scene flow, reserving layout space so the scene does not jump. */
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
  const roleplayThreadsRef = useRef(nav.roleplayThreads);
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const threadConnection = getProviderConnectionById(
    thread?.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const generationTransport = describeGenerationTransport();
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
  const castCompanions = thread
    ? nav.characters.filter((companion) => thread.characterIds.includes(companion.id))
    : [];
  const activePersona = thread?.activePersonaId
    ? (nav.personas.find((persona) => persona.id === thread.activePersonaId) ?? null)
    : null;

  useLayoutEffect(() => {
    roleplayThreadsRef.current = nav.roleplayThreads;
  }, [nav.roleplayThreads]);

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
    const sendTransport = describeGenerationTransport();
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
      message: `Generating through ${sendTransport.label}.`,
      action: null,
    });

    try {
      const result = await generateRoleplayThreadTurn({
        appSettings: nav.appSettings,
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: commitConnection.id,
        lorebooks: nav.lorebooks,
        loreRuntimeState: nav.getLoreRuntimeState("roleplay-thread", threadWithUserEntry.id),
        macroVariableStates: nav.macroVariableStates,
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

      const ownerExists = generationOriginStillExists({
        itemId: userEntry.id,
        selectItems: (candidate) => candidate.entries,
        threadId: threadWithUserEntry.id,
        threads: roleplayThreadsRef.current,
      });
      if (!ownerExists) {
        setGenerationState({
          threadId: commitThread.id,
          status: "idle",
          message: "",
          action: null,
        });
        return;
      }

      if (result.generatedEntryCount > 0) {
        nav.updateRoleplayThread(result.thread);
        nav.updateMacroVariableStates((currentStates) =>
          commitGenerationMacroVariableStates({
            ...result.macroVariableCommit,
            createId: createLocalId,
            macroVariableStates: currentStates,
            ownerExists,
          }),
        );
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
                `${sendTransport.label} did not return a Roleplay reply.`,
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

  function handleCopyEntry(entry: RoleplayEntry) {
    const body = getCopyableRoleplayEntryBody(entry);
    if (!body) return;
    void copyTextToClipboard(body);
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

  const sceneStatus = sendBlocker
    ? { tone: "attention" as const, label: sendBlocker }
    : isGenerating
      ? { tone: "pending" as const, label: generationStatusMessage || "Generating…" }
      : threadConnection
        ? { tone: "healthy" as const, label: threadConnection.label }
        : null;

  if (!thread) {
    return (
      <section className="roleplay-thread roleplay-thread-empty">
        <header className="roleplay-scene-header">
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
      <header className="roleplay-scene-header" aria-label="Roleplay scene header">
        {(castCompanions.length > 0 || activePersona) && (
          <ul className="roleplay-cast-strip" aria-label="Scene cast">
            {castCompanions.map((companion) => (
              <li key={`cast-${companion.id}`} className="roleplay-cast-chip character">
                <span className="roleplay-cast-avatar" aria-hidden="true">
                  {companion.avatarUrl ? (
                    <img src={companion.avatarUrl} alt="" />
                  ) : (
                    getInitials(companion.displayName)
                  )}
                </span>
                <span className="roleplay-cast-name">{companion.displayName}</span>
              </li>
            ))}
            {activePersona && (
              <li key={`cast-${activePersona.id}`} className="roleplay-cast-chip persona">
                <span className="roleplay-cast-avatar" aria-hidden="true">
                  {activePersona.avatarUrl ? (
                    <img src={activePersona.avatarUrl} alt="" />
                  ) : (
                    getInitials(activePersona.displayName)
                  )}
                </span>
                <span className="roleplay-cast-name">{activePersona.displayName}</span>
              </li>
            )}
          </ul>
        )}
        {sceneStatus && (
          <span className={`roleplay-scene-status ${sceneStatus.tone}`} title={sceneStatus.label}>
            <span className="roleplay-scene-status-dot" aria-hidden="true" />
            <span className="roleplay-scene-status-label">{sceneStatus.label}</span>
          </span>
        )}
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

      <div className="roleplay-entries" aria-label="Roleplay scene" ref={entryListRef}>
        {thread.entries.length === 0 && !isGenerating && (
          <p className="roleplay-empty-note">No messages yet.</p>
        )}
        {thread.entries.map((entry) => {
          const isEditing = activeEditingEntry?.id === entry.id;
          const isConfirmingDelete = activeDeleteRequest?.id === entry.id;
          const deleteRequestLabel = isConfirmingDelete
            ? (activeDeleteRequest?.label ?? entry.label)
            : entry.label;
          const authorAvatar = getEntryAuthorAvatar(entry);
          const timeLabel = getMessageTimeLabel(entry.createdAt);
          const own = isOwnRoleplayEntry(entry);
          const speakerChip =
            entry.role === "character"
              ? "Character"
              : entry.role === "persona"
                ? "Persona"
                : entry.role === "narration"
                  ? "Narration"
                  : "Scene";

          return (
            <Fragment key={entry.id}>
              {entry.role === "narration" ? (
                <article
                  className={`roleplay-narration${isEditing ? " editing" : ""}${
                    isConfirmingDelete ? " confirming-delete" : ""
                  }`}
                  aria-label={`Narration from ${entry.label}`}
                >
                  {isEditing ? (
                    <div className="roleplay-entry-edit-form">
                      <textarea
                        ref={editTextareaRef}
                        aria-label={`Edit narration from ${entry.label}`}
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
                          aria-label={`Save edited narration from ${entry.label}`}
                          disabled={!activeEditingEntry?.body.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing narration from ${entry.label}`}
                          onClick={handleCancelEditEntry}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="roleplay-narration-body">{entry.body}</p>
                      {timeLabel && (
                        <time
                          className="roleplay-narration-timestamp"
                          dateTime={entry.createdAt}
                          title={getMessageDateTimeTitle(entry.createdAt)}
                        >
                          {timeLabel}
                        </time>
                      )}
                      <div className="roleplay-entry-actions" aria-label="Narration actions">
                        {isConfirmingDelete ? (
                          <div
                            className="roleplay-entry-delete-confirm"
                            role="group"
                            aria-label={`Confirm delete narration from ${deleteRequestLabel}`}
                            onKeyDown={handleDeleteConfirmKeyDown}
                          >
                            <button
                              ref={deleteConfirmRef}
                              type="button"
                              aria-label={`Confirm delete narration from ${deleteRequestLabel}`}
                              onClick={() => commitDeleteEntry(entry.id)}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              aria-label={`Cancel delete narration from ${deleteRequestLabel}`}
                              onClick={handleCancelDeleteEntry}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Copy narration from ${entry.label}`}
                              title="Copy"
                              onClick={() => handleCopyEntry(entry)}
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Edit narration from ${entry.label}`}
                              title="Edit"
                              onClick={() => handleEditEntry(entry)}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              className="roleplay-action-pill"
                              aria-label={`Delete narration from ${entry.label}`}
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
                </article>
              ) : (
                <article
                  className={`roleplay-entry ${entry.role}${own ? " own" : ""}${
                    isEditing ? " editing" : ""
                  }${isConfirmingDelete ? " confirming-delete" : ""}`}
                  aria-label={`${speakerChip} entry from ${entry.label}`}
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
                                  className="roleplay-action-pill"
                                  aria-label={`Copy Roleplay entry from ${entry.label}`}
                                  title="Copy"
                                  onClick={() => handleCopyEntry(entry)}
                                >
                                  ⧉
                                </button>
                                <button
                                  type="button"
                                  className="roleplay-action-pill"
                                  aria-label={`Edit Roleplay entry from ${entry.label}`}
                                  title="Edit"
                                  onClick={() => handleEditEntry(entry)}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="roleplay-action-pill"
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
                  </div>
                </article>
              )}
            </Fragment>
          );
        })}
        {isGenerating && <RoleplayPendingRow label={generationTransport.label} />}
      </div>

      <GenerationNotice
        action={generationNoticeAction}
        fallbackMessage={`${generationTransport.label} is replying through the provider path.`}
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
              `${generationTransport.label} is replying through the provider-neutral path.`
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
