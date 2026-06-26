import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  appendClassicEntries,
  createNarrationClassicEntry,
  createPersonaClassicEntry,
} from "../../../engine/classic-actions";
import { getProviderConnectionById } from "../../../engine/provider-connection";
import { CLASSIC } from "../../../engine/surfaces";
import {
  generateClassicThreadTurn,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime";
import type {
  NavCatalogState,
  NavClassicThreadActions,
  NavSettingsState,
  NavThreadState,
  NavViewState,
} from "../../navigation";
import { ChatComposer } from "../shared";
import "./classic-thread.css";

export type ClassicThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<NavClassicThreadActions, "createClassicThread" | "updateClassicThread"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "classicThreads"> &
  Pick<NavViewState, "view">;

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface ClassicThreadProps {
  nav: ClassicThreadNav;
}

function ClassicChatSettingsButton() {
  return (
    <button
      type="button"
      className="classic-chat-settings-button"
      title="Chat settings"
      aria-label="Chat settings"
      disabled
    >
      <span aria-hidden="true">⚙</span>
    </button>
  );
}

export function ClassicThread({ nav }: ClassicThreadProps) {
  const activeThreadId = nav.view.kind === "classic" ? nav.view.threadId : null;
  const thread =
    nav.classicThreads.find((candidate) => candidate.id === activeThreadId) ??
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
  const generationMode = getMessengerGenerationModeForConnection(threadConnection);
  const generationRuntime = selectMessengerGenerationRuntime(generationMode);
  const isGenerating =
    generationState.threadId === activeThreadId &&
    generationState.status === "generating";
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

  async function sendDraft() {
    if (!thread) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;

    const sentAt = new Date().toISOString();
    const userEntry = activePersona
      ? createPersonaClassicEntry({
          body: trimmedDraft,
          id: createLocalId("classic-entry"),
          now: sentAt,
          persona: activePersona,
          thread,
        })
      : createNarrationClassicEntry({
          body: trimmedDraft,
          id: createLocalId("classic-entry"),
          now: sentAt,
          thread,
        });
    const threadWithUserEntry = appendClassicEntries(thread, [userEntry], sentAt);

    nav.updateClassicThread(threadWithUserEntry);
    setDraftState({ body: "", threadId: activeThreadId });
    setGenerationState({
      threadId: thread.id,
      status: "generating",
      message: `Generating through ${generationRuntime.label}.`,
    });

    try {
      const result = await generateClassicThreadTurn({
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: threadConnection.id,
        lorebooks: nav.lorebooks,
        mode: generationMode,
        now: sentAt,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: threadWithUserEntry,
      });

      if (result.generatedEntryCount > 0) {
        nav.updateClassicThread(result.thread);
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
                `${generationRuntime.label} did not return a Classic reply.`,
            },
      );
    } catch (error) {
      setGenerationState({
        threadId: thread.id,
        status: "error",
        message:
          error instanceof Error ? error.message : "Classic generation failed.",
      });
    }

    return true;
  }

  function handleSend() {
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
      nav.appSettings.sendOnEnterSurface !== CLASSIC
    ) {
      return;
    }

    event.preventDefault();
    void sendDraft();
  }

  if (!thread) {
    return (
      <section className="classic-thread classic-thread-empty">
        <header className="classic-header">
          <div className="classic-header-icons">
            <ClassicChatSettingsButton />
          </div>
        </header>
        <div className="classic-empty">
          <button type="button" onClick={() => nav.createClassicThread()}>
            + Start a Classic chat
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="classic-thread" aria-label="Classic thread">
      <header className="classic-header">
        <div className="classic-header-icons">
          <ClassicChatSettingsButton />
        </div>
      </header>

      <div
        className="classic-entries"
        aria-label="Classic chat messages"
        ref={entryListRef}
      >
        {thread.entries.map((entry) => (
          <article className={`classic-entry ${entry.role}`} key={entry.id}>
            <div className="classic-entry-head">
              <b>{entry.label}</b>
              {entry.origin === "generated" && <span>Generated</span>}
            </div>
            <p>{entry.body}</p>
          </article>
        ))}
        {thread.entries.length === 0 && (
          <p className="classic-empty-note">No messages yet.</p>
        )}
      </div>

      <ChatComposer
        ariaLabel="Classic composer"
        draftAriaLabel="Draft Classic message"
        disabled={!canSend}
        hint={
          generationNotice ||
          (isGenerating
            ? `${generationRuntime.label} is replying through the provider-neutral path.`
            : nav.appSettings.sendOnEnterSurface === CLASSIC
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
        placeholder="Write a Classic message..."
        submitBusyLabel="Generating reply"
        submitLabel="Send message"
        value={draft}
      />
    </section>
  );
}
