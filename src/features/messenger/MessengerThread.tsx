import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useNav } from "../../shared/ui/nav-context";
import { type MessengerMessage } from "../../engine/messenger";
import { getProviderConnectionById } from "../../engine/provider-connection";
import { MESSENGER } from "../../engine/surfaces";
import {
  appendMessengerMessages,
  createPersonaMessengerMessage,
  setMessengerThreadLorebooks,
  setMessengerThreadParticipants,
  setMessengerThreadPersona,
  setMessengerThreadProviderConnection,
} from "../../engine/messenger-actions";
import {
  generateMessengerThreadReply,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime/messenger-generation";
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
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "error";
    message: string;
  }>({ threadId: null, status: "idle", message: "" });
  const [settingsState, setSettingsState] = useState<{
    threadId: string | null;
    open: boolean;
  }>({ threadId: null, open: false });
  const settingsOpen =
    settingsState.threadId === activeThreadId && settingsState.open;
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
  const generationError =
    generationState.threadId === activeThreadId &&
    generationState.status === "error"
      ? generationState.message
      : "";
  const canSend = draft.trim().length > 0 && !isGenerating;
  const storageLabel =
    nav.messengerStorageStatus === "saving"
      ? "Saving..."
      : nav.messengerStorageMode === "remote"
        ? "Remote runtime"
        : nav.messengerStorageStatus === "error"
          ? "Local fallback"
          : "Saved locally";
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

  function openCatalogCare() {
    nav.setCareTab(4);
    nav.setCareOpen(true);
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
        activePersona,
        companions: threadCompanions,
        createId: createLocalId,
        lorebooks: threadLorebooks,
        mode: generationMode,
        now: sentAt,
        thread: threadWithUserMessage,
        userMessage,
      });

      if (result.generatedMessages.length > 0) {
        nav.updateMessengerThread(result.thread);
      }

      setGenerationState(
        result.generatedMessages.length > 0
          ? { threadId: messengerThread.id, status: "idle", message: "" }
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
                {nav.providerConnections.map((connection) => (
                  <option value={connection.id} key={connection.id}>
                    {connection.label}
                  </option>
                ))}
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
                        <small>{companion.summary || "No summary."}</small>
                      </span>
                    </label>
                  );
                })}
                {nav.characters.length === 0 && (
                  <button
                    type="button"
                    className="thread-open-catalog"
                    onClick={openCatalogCare}
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
                    onClick={openCatalogCare}
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
          {generationError ||
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
