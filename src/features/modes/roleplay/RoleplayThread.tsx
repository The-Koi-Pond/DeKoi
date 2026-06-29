import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  appendRoleplayEntries,
  createNarrationRoleplayEntry,
  createPersonaRoleplayEntry,
  deleteRoleplayEntry,
  updateRoleplayEntryBody,
} from "../../../engine/roleplay-actions";
import type { RoleplayEntry } from "../../../engine/roleplay";
import {
  getProviderConnectionById,
  getProviderConnectionGenerationBlocker,
  isProviderConnectionReady,
} from "../../../engine/provider-connection";
import { ROLEPLAY } from "../../../engine/surfaces";
import {
  generateRoleplayThreadTurn,
  formatGenerationFailureNotice,
  getGenerationModeForConnection,
  selectGenerationRuntime,
} from "../../runtime";
import type {
  NavCatalogState,
  NavRoleplayThreadActions,
  NavSettingsState,
  NavThreadState,
  NavViewState,
} from "../../navigation";
import { ChatComposer } from "../shared";
import {
  getMessageDateTimeTitle,
  getMessageTimeLabel,
} from "../shared/message-time";
import "./roleplay-thread.css";

export type RoleplayThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavRoleplayThreadActions, "createRoleplayThread" | "updateRoleplayThread"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "roleplayThreads"> &
  Pick<NavViewState, "view">;

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface RoleplayThreadProps {
  nav: RoleplayThreadNav;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function isOwnRoleplayEntry(entry: RoleplayEntry) {
  return entry.role === "persona" || entry.role === "narration";
}

function RoleplayChatSettingsButton() {
  return (
    <button
      type="button"
      className="roleplay-chat-settings-button"
      title="Chat settings"
      aria-label="Chat settings"
      disabled
    >
      <span aria-hidden="true">⚙</span>
    </button>
  );
}

export function RoleplayThread({ nav }: RoleplayThreadProps) {
  const activeThreadId = nav.view.kind === "roleplay" ? nav.view.threadId : null;
  const thread =
    nav.roleplayThreads.find((candidate) => candidate.id === activeThreadId) ??
    null;
  const [draftState, setDraftState] = useState<{
    threadId: string | null;
    body: string;
  }>({ threadId: null, body: "" });
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "warning" | "error";
    message: string;
  }>({ threadId: null, status: "idle", message: "" });
  const [editingEntry, setEditingEntry] = useState<{
    id: string;
    body: string;
  } | null>(null);
  const entryListRef = useRef<HTMLDivElement>(null);
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const activePersona = thread?.activePersonaId
    ? nav.personas.find((persona) => persona.id === thread.activePersonaId) ??
      null
    : null;
  const threadConnection = getProviderConnectionById(
    thread?.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const generationMode = getGenerationModeForConnection(threadConnection);
  const generationRuntime = selectGenerationRuntime(generationMode);
  const isGenerating =
    generationState.threadId === activeThreadId &&
    generationState.status === "generating";
  const visibleGenerationStatus =
    generationState.threadId === activeThreadId ? generationState.status : "idle";
  const generationNotice =
    generationState.threadId === activeThreadId &&
    (generationState.status === "warning" || generationState.status === "error")
      ? generationState.message
      : "";
  const canSend = !!thread && draft.trim().length > 0 && !isGenerating;

  useEffect(() => {
    if (!entryListRef.current) return;
    if (!thread) return;
    entryListRef.current.scrollTop = entryListRef.current.scrollHeight;
  }, [thread, thread?.entries.length]);

  function handleEditEntry(entry: RoleplayEntry) {
    setEditingEntry({ id: entry.id, body: entry.body });
  }

  function handleCancelEditEntry() {
    setEditingEntry(null);
  }

  function handleSaveEditedEntry() {
    if (!thread || !editingEntry) return;
    const trimmedBody = editingEntry.body.trim();
    if (!trimmedBody) return;

    nav.updateRoleplayThread(
      updateRoleplayEntryBody(
        thread,
        editingEntry.id,
        trimmedBody,
        new Date().toISOString(),
      ),
    );
    setEditingEntry(null);
  }

  function handleDeleteEntry(entryId: string) {
    if (!thread) return;
    nav.updateRoleplayThread(deleteRoleplayEntry(thread, entryId));
    if (editingEntry?.id === entryId) {
      setEditingEntry(null);
    }
  }

  async function sendDraft() {
    if (!thread) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    const generationBlocker = getProviderConnectionGenerationBlocker(threadConnection);
    if (generationBlocker || !isProviderConnectionReady(threadConnection)) {
      setGenerationState({
        threadId: thread.id,
        status: "error",
        message:
          generationBlocker ?? "Create or select a connection before generating.",
      });
      return false;
    }

    const sentAt = new Date().toISOString();
    const userEntry = activePersona
      ? createPersonaRoleplayEntry({
          body: trimmedDraft,
          id: createLocalId("roleplay-entry"),
          now: sentAt,
          persona: activePersona,
          thread,
        })
      : createNarrationRoleplayEntry({
          body: trimmedDraft,
          id: createLocalId("roleplay-entry"),
          now: sentAt,
          thread,
        });
    const threadWithUserEntry = appendRoleplayEntries(thread, [userEntry]);

    nav.updateRoleplayThread(threadWithUserEntry);
    setDraftState({ body: "", threadId: activeThreadId });
    setGenerationState({
      threadId: thread.id,
      status: "generating",
      message: `Generating through ${generationRuntime.label}.`,
    });

    try {
      const result = await generateRoleplayThreadTurn({
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
        thread: threadWithUserEntry,
      });

      if (result.generatedEntryCount > 0) {
        nav.updateRoleplayThread(result.thread);
      }

      setGenerationState(
        result.generatedEntryCount > 0
          ? {
              threadId: thread.id,
              status: result.warnings.length > 0 ? "warning" : "idle",
              message: result.warnings[0] ?? "",
            }
          : {
              threadId: thread.id,
              status: "error",
              message:
                result.warnings[0] ??
                `${generationRuntime.label} did not return a Roleplay reply.`,
            },
      );
    } catch (error) {
      setGenerationState({
        threadId: thread.id,
        status: "error",
        message: formatGenerationFailureNotice(
          error,
          "Roleplay generation failed.",
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
        nav.characters.find((candidate) => candidate.id === entry.characterId) ??
        null;
      return {
        avatarUrl: character?.avatarUrl ?? null,
        initials: getInitials(character?.displayName ?? entry.label),
      };
    }

    if (entry.role === "persona" && entry.personaId) {
      const persona =
        nav.personas.find((candidate) => candidate.id === entry.personaId) ??
        null;
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
            <RoleplayChatSettingsButton />
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
          <RoleplayChatSettingsButton />
        </div>
      </header>

      <div
        className="roleplay-entries"
        aria-label="Roleplay chat messages"
        ref={entryListRef}
      >
        {thread.entries.map((entry) => {
          const isEditing = editingEntry?.id === entry.id;
          const authorAvatar = getEntryAuthorAvatar(entry);
          const timeLabel = getMessageTimeLabel(entry.createdAt);

          return (
            <article
              className={`roleplay-entry ${entry.role}${
                isOwnRoleplayEntry(entry) ? " own" : ""
              }${isEditing ? " editing" : ""}`}
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
                      aria-label={`Edit Roleplay entry from ${entry.label}`}
                      value={editingEntry.body}
                      onChange={(event) =>
                        setEditingEntry({
                          id: entry.id,
                          body: event.target.value,
                        })
                      }
                    />
                    <div className="roleplay-entry-edit-actions">
                      <button
                        type="button"
                        onClick={handleSaveEditedEntry}
                        disabled={!editingEntry.body.trim()}
                      >
                        Save
                      </button>
                      <button type="button" onClick={handleCancelEditEntry}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{entry.body}</p>
                    <div className="roleplay-entry-actions" aria-label="Entry actions">
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
                        onClick={() => handleDeleteEntry(entry.id)}
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}
        {thread.entries.length === 0 && (
          <p className="roleplay-empty-note">No messages yet.</p>
        )}
      </div>

      {visibleGenerationStatus !== "idle" && (
        <div
          className={`thread-generation-notice ${visibleGenerationStatus}`}
          role={visibleGenerationStatus === "error" ? "alert" : "status"}
        >
          <span>
            {generationNotice ||
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
        ariaLabel="Roleplay composer"
        draftAriaLabel="Draft Roleplay message"
        disabled={!canSend}
        hint={
          generationNotice ||
          (isGenerating
            ? `${generationRuntime.label} is replying through the provider-neutral path.`
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
