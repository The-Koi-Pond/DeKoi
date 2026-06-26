import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import type {
  NavCatalogState,
  NavMessengerThreadActions,
  NavRippleActions,
  NavSettingsState,
  NavStorageState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import { type MessengerMessage } from "../../../engine/messenger";
import {
  getProviderConnectionById,
  sanitizeProviderConnectionRecord,
} from "../../../engine/provider-connection";
import { MESSENGER } from "../../../engine/surfaces";
import {
  appendMessengerMessages,
  createPersonaMessengerMessage,
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadProviderConnection,
} from "../../../engine/messenger-actions";
import {
  RIPPLE_DOCK_SURFACE_LABEL,
  type Ripple,
  type RippleTone,
} from "../../../engine/ripples";
import {
  generateMessengerThreadReply,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime";
import "./messenger-thread.css";

export type MessengerThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavMessengerThreadActions, "clearMessengerThreadMessages" | "createMessengerThread" | "updateMessengerThread"> &
  Pick<NavRippleActions, "createRipple" | "deleteRipple" | "getRippleState" | "updateRipple"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavStorageState, "messengerStorageMessage" | "messengerStorageMode" | "messengerStorageStatus"> &
  Pick<NavThreadState, "messengerThreads"> &
  Pick<NavViewActions, "setView"> &
  Pick<NavViewState, "view">;

const EMPTY_RIPPLE_DRAFT = {
  body: "",
  threadId: null as string | null,
  title: "",
  tone: "note" as RippleTone,
};

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

function readRippleTone(value: string): RippleTone {
  if (value === "shift" || value === "meter") return value;
  return "note";
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
  const [settingsState, setSettingsState] = useState<{
    threadId: string | null;
    open: boolean;
  }>({ threadId: null, open: false });
  const [rippleDraft, setRippleDraft] = useState<{
    body: string;
    threadId: string | null;
    title: string;
    tone: RippleTone;
  }>(EMPTY_RIPPLE_DRAFT);
  const [editingRipple, setEditingRipple] = useState<{
    rippleId: string | null;
    threadId: string | null;
  }>({ rippleId: null, threadId: null });
  const settingsOpen =
    settingsState.threadId === activeThreadId && settingsState.open;
  const activeRippleState = messengerThread
    ? nav.getRippleState("messenger-thread", messengerThread.id)
    : null;
  const activeRipples = activeRippleState?.ripples ?? [];
  const activeRippleDraft =
    rippleDraft.threadId === activeThreadId ? rippleDraft : EMPTY_RIPPLE_DRAFT;
  const activeEditingRippleId =
    editingRipple.threadId === activeThreadId ? editingRipple.rippleId : null;
  const canSaveRipple =
    activeRippleDraft.title.trim().length > 0 ||
    activeRippleDraft.body.trim().length > 0;
  const messageListRef = useRef<HTMLDivElement>(null);
  const threadCompanions = messengerThread
    ? nav.characters.filter((companion) =>
        messengerThread.characterIds.includes(companion.id),
      )
    : nav.characters;
  const activePersona = messengerThread?.activePersonaId
    ? nav.personas.find(
        (persona) => persona.id === messengerThread.activePersonaId,
      ) ?? null
    : nav.personas[0] ?? null;
  const threadLorebooks = messengerThread
    ? nav.lorebooks.filter((lorebook) =>
        messengerThread.lorebookIds.includes(lorebook.id),
      )
    : nav.lorebooks;
  const selectedCharacterIds = new Set(messengerThread?.characterIds ?? []);
  const selectedLorebookIds = new Set(messengerThread?.lorebookIds ?? []);
  const missingCharacterIds = messengerThread
    ? messengerThread.characterIds.filter(
        (id) => !nav.characters.some((companion) => companion.id === id),
      )
    : [];
  const missingLorebookIds = messengerThread
    ? messengerThread.lorebookIds.filter(
        (id) => !nav.lorebooks.some((lorebook) => lorebook.id === id),
      )
    : [];
  const missingPersonaId =
    messengerThread?.activePersonaId && !activePersona
      ? messengerThread.activePersonaId
      : "";
  const configuredConnection = messengerThread?.providerConnectionId
    ? nav.providerConnections.find(
        (connection) => connection.id === messengerThread.providerConnectionId,
      ) ?? null
    : null;
  const missingConnectionId =
    messengerThread?.providerConnectionId && !configuredConnection
      ? messengerThread.providerConnectionId
      : "";
  const participantSummary = threadCompanions
    .map((companion) => companion.displayName)
    .join(" + ") || "no companions";
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const isGenerating =
    generationState.threadId === activeThreadId &&
    generationState.status === "generating";
  const generationNotice =
    generationState.threadId === activeThreadId &&
    (generationState.status === "error" || generationState.status === "warning")
      ? generationState.message
      : "";
  const canSend = draft.trim().length > 0 && !isGenerating;
  const storageLabel =
    nav.messengerStorageStatus === "saving"
      ? "Saving..."
      : nav.messengerStorageMode === "remote"
        ? "Remote runtime"
        : nav.messengerStorageMode === "desktop"
          ? "Desktop host"
        : nav.messengerStorageStatus === "error"
          ? "Storage unavailable"
          : "Host storage";
  const threadConnection = getProviderConnectionById(
    messengerThread?.providerConnectionId ??
      nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const selectedConnectionId =
    messengerThread?.providerConnectionId && configuredConnection
      ? messengerThread.providerConnectionId
      : threadConnection.id;
  const missingReferenceLabels = [
    missingCharacterIds.length > 0
      ? `${missingCharacterIds.length} missing companion${
          missingCharacterIds.length === 1 ? "" : "s"
        }`
      : "",
    missingLorebookIds.length > 0
      ? `${missingLorebookIds.length} missing lorebook${
          missingLorebookIds.length === 1 ? "" : "s"
        }`
      : "",
    missingPersonaId ? "missing persona" : "",
    missingConnectionId ? "missing connection" : "",
  ].filter(Boolean);
  const generationMode = getMessengerGenerationModeForConnection(threadConnection);
  const generationRuntime = selectMessengerGenerationRuntime(generationMode);

  useEffect(() => {
    if (!messageListRef.current) return;
    if (!messengerThread) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messengerThread, messengerThread?.messages.length]);

  function handlePersonaChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!messengerThread) return;
    nav.updateMessengerThread(
      setMessengerThreadPersona(
        messengerThread,
        event.target.value || null,
        new Date().toISOString(),
      ),
    );
  }

  function handleConnectionChange(event: ChangeEvent<HTMLSelectElement>) {
    if (!messengerThread) return;
    nav.updateMessengerThread(
      setMessengerThreadProviderConnection(
        messengerThread,
        event.target.value || null,
        new Date().toISOString(),
      ),
    );
  }

  function toggleCompanion(characterId: string) {
    if (!messengerThread) return;

    const nextIds = new Set(messengerThread.characterIds);
    const selectedKnownCount = nav.characters.filter((companion) =>
      nextIds.has(companion.id),
    ).length;

    if (nextIds.has(characterId)) {
      if (selectedKnownCount <= 1) return;
      nextIds.delete(characterId);
    } else {
      nextIds.add(characterId);
    }

    nav.updateMessengerThread(
      setMessengerThreadParticipants(
        messengerThread,
        nav.characters
          .map((companion) => companion.id)
          .filter((id) => nextIds.has(id)),
        new Date().toISOString(),
      ),
    );
  }

  function toggleLorebook(lorebookId: string) {
    if (!messengerThread) return;

    const nextIds = new Set(messengerThread.lorebookIds);
    if (nextIds.has(lorebookId)) {
      nextIds.delete(lorebookId);
    } else {
      nextIds.add(lorebookId);
    }

    nav.updateMessengerThread(
      setMessengerThreadLorebooks(
        messengerThread,
        nav.lorebooks
          .map((lorebook) => lorebook.id)
          .filter((id) => nextIds.has(id)),
        new Date().toISOString(),
      ),
    );
  }

  function openCompanionsCatalog() {
    nav.setView({ kind: "companions" });
  }

  function openLorebooksCatalog() {
    nav.setView({ kind: "lorebooks" });
  }

  function resetRippleDraft() {
    setRippleDraft(EMPTY_RIPPLE_DRAFT);
    setEditingRipple({ rippleId: null, threadId: null });
  }

  function editRipple(ripple: Ripple) {
    if (!messengerThread) return;
    setRippleDraft({
      body: ripple.body,
      threadId: messengerThread.id,
      title: ripple.title,
      tone: ripple.tone,
    });
    setEditingRipple({ rippleId: ripple.id, threadId: messengerThread.id });
  }

  function handleRippleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!messengerThread || !canSaveRipple) return;

    const input = {
      body: activeRippleDraft.body,
      title: activeRippleDraft.title,
      tone: activeRippleDraft.tone,
    };

    if (activeEditingRippleId) {
      nav.updateRipple(
        "messenger-thread",
        messengerThread.id,
        activeEditingRippleId,
        input,
      );
    } else {
      nav.createRipple("messenger-thread", messengerThread.id, input);
    }

    resetRippleDraft();
  }

  function handleRippleDelete(rippleId: string) {
    if (!messengerThread) return;
    nav.deleteRipple("messenger-thread", messengerThread.id, rippleId);
    if (activeEditingRippleId === rippleId) {
      resetRippleDraft();
    }
  }

  async function sendDraft() {
    if (!messengerThread) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    if (!activePersona) {
      setGenerationState({
        threadId: messengerThread.id,
        status: "error",
        message: "Add a persona before sending a Messenger message.",
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
    const userMessage = createPersonaMessengerMessage({
      body: trimmedDraft,
      id: createLocalId("messenger-message"),
      now: sentAt,
      persona: activePersona,
      thread: threadForSend,
    });
    const threadWithUserMessage = appendMessengerMessages(
      threadForSend,
      [userMessage],
      sentAt,
    );

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
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: threadWithUserMessage,
        userMessage,
      });

      if (result.generatedMessages.length > 0) {
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
        message:
          error instanceof Error
            ? error.message
            : "Messenger generation failed.",
      });
    }

    return true;
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendDraft();
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

  function handleResetThread() {
    if (!messengerThread) return;
    nav.clearMessengerThreadMessages(messengerThread.id);
    setDraftState({ body: "", threadId: activeThreadId });
    setGenerationState({ threadId: activeThreadId, status: "idle", message: "" });
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
          <button
            type="button"
            className={`thread-settings-toggle${settingsOpen ? " on" : ""}`}
            aria-expanded={settingsOpen}
            onClick={() =>
              setSettingsState((current) => ({
                threadId: activeThreadId,
                open:
                  current.threadId === activeThreadId ? !current.open : true,
              }))
            }
          >
            Settings
          </button>
          <span className="storage-chip" title={nav.messengerStorageMessage}>
            {storageLabel}
          </span>
          <span className="storage-chip" title={threadConnection.summary}>
            {threadConnection.label}
          </span>
          <div className="participant-stack" aria-label="Thread participants">
            {activePersona && (
              <span title={activePersona.displayName}>
                {getInitials(activePersona.displayName)}
              </span>
            )}
            {threadCompanions.map((companion) => (
              <span title={companion.displayName} key={companion.id}>
                {getInitials(companion.displayName)}
              </span>
            ))}
          </div>
        </div>
      </header>

      {settingsOpen && (
        <section
          className="thread-settings"
          aria-label="Messenger thread settings"
        >
          <div className="thread-settings-grid">
            <label className="thread-setting-field">
              <span>Persona</span>
              <select value={messengerThread.activePersonaId ?? ""} onChange={handlePersonaChange}>
                <option value="">No persona</option>
                {missingPersonaId && (
                  <option value={missingPersonaId} disabled>
                    Missing persona
                  </option>
                )}
                {nav.personas.map((persona) => (
                  <option value={persona.id} key={persona.id}>
                    {persona.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="thread-setting-field">
              <span>Connection</span>
              <select
                value={selectedConnectionId}
                onChange={handleConnectionChange}
                disabled={nav.providerConnections.length === 0}
              >
                {missingConnectionId && (
                  <option value={missingConnectionId} disabled>
                    Missing connection
                  </option>
                )}
                {nav.providerConnections.map((rawConnection) => {
                  const connection = sanitizeProviderConnectionRecord(rawConnection);
                  return (
                    <option value={connection.id} key={connection.id}>
                      {connection.label}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          <div className="thread-choice-columns">
            <section className="thread-choice-group" aria-labelledby="thread-companions">
              <div className="thread-choice-head">
                <b id="thread-companions">Companions</b>
                <span>{threadCompanions.length} selected</span>
              </div>
              <div className="thread-choice-list">
                {nav.characters.map((companion) => {
                  const selected = selectedCharacterIds.has(companion.id);
                  const selectedKnownCount = nav.characters.filter((character) =>
                    selectedCharacterIds.has(character.id),
                  ).length;

                  return (
                    <label
                      className={`thread-check${selected ? " on" : ""}`}
                      key={companion.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        disabled={selected && selectedKnownCount <= 1}
                        onChange={() => toggleCompanion(companion.id)}
                      />
                      <span>
                        <b>{companion.displayName}</b>
                        <small>{companion.personality || "No personality summary."}</small>
                      </span>
                    </label>
                  );
                })}
                {nav.characters.length === 0 && (
                  <button
                    type="button"
                    className="thread-open-catalog"
                    onClick={openCompanionsCatalog}
                  >
                    Open Catalog
                  </button>
                )}
              </div>
            </section>

            <section className="thread-choice-group" aria-labelledby="thread-lorebooks">
              <div className="thread-choice-head">
                <b id="thread-lorebooks">Lorebooks</b>
                <span>{threadLorebooks.length} selected</span>
              </div>
              <div className="thread-choice-list">
                {nav.lorebooks.map((lorebook) => {
                  const selected = selectedLorebookIds.has(lorebook.id);

                  return (
                    <label
                      className={`thread-check${selected ? " on" : ""}`}
                      key={lorebook.id}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleLorebook(lorebook.id)}
                      />
                      <span>
                        <b>{lorebook.title}</b>
                        <small>{lorebook.summary || "No summary."}</small>
                      </span>
                    </label>
                  );
                })}
                {nav.lorebooks.length === 0 && (
                  <button
                    type="button"
                    className="thread-open-catalog"
                    onClick={openLorebooksCatalog}
                  >
                    Open Catalog
                  </button>
                )}
              </div>
            </section>
          </div>

          {missingReferenceLabels.length > 0 && (
            <p className="thread-settings-warning">
              Missing references: {missingReferenceLabels.join(", ")}.
            </p>
          )}
        </section>
      )}

      <section className="ripple-dock" aria-labelledby="messenger-ripple-title">
        <div className="ripple-dock-head">
          <div>
            <h3 id="messenger-ripple-title">{RIPPLE_DOCK_SURFACE_LABEL}</h3>
            <span>{activeRipples.length} active</span>
          </div>
        </div>

        <div className="ripple-list">
          {activeRipples.map((ripple) => (
            <article className="ripple-item" data-tone={ripple.tone} key={ripple.id}>
              <div>
                <b>{ripple.title}</b>
                {ripple.body && <p>{ripple.body}</p>}
              </div>
              <div className="ripple-item-tools">
                <span>{ripple.tone}</span>
                <button type="button" onClick={() => editRipple(ripple)}>
                  Edit
                </button>
                <button type="button" onClick={() => handleRippleDelete(ripple.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
          {activeRipples.length === 0 && (
            <p className="ripple-empty">No Ripples yet.</p>
          )}
        </div>

        <form className="ripple-form" onSubmit={handleRippleSubmit}>
          <select
            aria-label="Ripple tone"
            value={activeRippleDraft.tone}
            onChange={(event) =>
              setRippleDraft({
                ...activeRippleDraft,
                threadId: messengerThread.id,
                tone: readRippleTone(event.target.value),
              })
            }
          >
            <option value="note">Note</option>
            <option value="shift">Shift</option>
            <option value="meter">Meter</option>
          </select>
          <input
            aria-label="Ripple title"
            placeholder="Ripple title"
            value={activeRippleDraft.title}
            onChange={(event) =>
              setRippleDraft({
                ...activeRippleDraft,
                threadId: messengerThread.id,
                title: event.target.value,
              })
            }
          />
          <input
            aria-label="Ripple body"
            placeholder="Current value or note"
            value={activeRippleDraft.body}
            onChange={(event) =>
              setRippleDraft({
                ...activeRippleDraft,
                body: event.target.value,
                threadId: messengerThread.id,
              })
            }
          />
          <div className="ripple-form-actions">
            {activeEditingRippleId && (
              <button type="button" onClick={resetRippleDraft}>
                Cancel
              </button>
            )}
            <button type="submit" disabled={!canSaveRipple}>
              {activeEditingRippleId ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </section>

      <div
        className="message-list"
        aria-label="Messenger messages"
        ref={messageListRef}
      >
        {messengerThread.messages.map((message) => (
          <article className={getMessageClassName(message)} key={message.id}>
            <div className="message-author">
              {message.author.label}
              {message.origin === "generated" && <span>Generated</span>}
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
            {isGenerating ? "Generating" : "Send"}
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
          {generationNotice ||
          (isGenerating
            ? `${generationRuntime.label} is replying through the provider-neutral path.`
            : nav.appSettings.sendOnEnterSurface === MESSENGER
            ? "Enter sends. Shift+Enter adds a new line."
            : "Enter adds a new line. Use Send to release the message.")}
        </p>
      </form>
    </section>
  );
}
