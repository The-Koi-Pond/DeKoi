import { useState, type FormEvent } from "react";
import { updateClassicSceneText } from "../../../engine/classic-actions";
import { getProviderConnectionById } from "../../../engine/provider-connection";
import {
  generateClassicThreadTurn,
  getMessengerGenerationModeForConnection,
  selectMessengerGenerationRuntime,
} from "../../runtime";
import { useNav } from "../../navigation";
import "./classic-thread.css";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ClassicThread() {
  const nav = useNav();
  const activeThreadId = nav.view.kind === "classic" ? nav.view.threadId : null;
  const thread =
    nav.classicThreads.find((candidate) => candidate.id === activeThreadId) ??
    null;
  const [sceneDraft, setSceneDraft] = useState<{
    threadId: string | null;
    body: string;
  }>({ threadId: null, body: "" });
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "warning" | "error";
    message: string;
  }>({ threadId: null, status: "idle", message: "" });
  const sceneText =
    sceneDraft.threadId === activeThreadId ? sceneDraft.body : thread?.sceneText ?? "";
  const threadCharacters = thread
    ? nav.characters.filter((character) => thread.characterIds.includes(character.id))
    : [];
  const activePersona =
    thread?.activePersonaId
      ? nav.personas.find((persona) => persona.id === thread.activePersonaId) ??
        null
      : nav.personas[0] ?? null;
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
  const canGenerate =
    !!thread && threadCharacters.length > 0 && sceneText.trim().length > 0 && !isGenerating;

  function handleBack() {
    nav.setView({ kind: "pond" });
  }

  function saveSceneDraft() {
    if (!thread) return thread;
    if (sceneText === thread.sceneText) return thread;

    const updatedThread = updateClassicSceneText(
      thread,
      sceneText,
      new Date().toISOString(),
    );
    nav.updateClassicThread(updatedThread);
    return updatedThread;
  }

  async function generateTurn() {
    if (!thread) return;
    const threadForGeneration = saveSceneDraft();
    if (!threadForGeneration) return;

    if (threadCharacters.length === 0) {
      setGenerationState({
        threadId: thread.id,
        status: "error",
        message: "Add a companion before generating a Classic turn.",
      });
      return;
    }

    if (!threadForGeneration.sceneText.trim()) {
      setGenerationState({
        threadId: thread.id,
        status: "error",
        message: "Add scene text before generating a Classic turn.",
      });
      return;
    }

    const now = new Date().toISOString();
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
        now,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
        thread: threadForGeneration,
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
                `${generationRuntime.label} did not return a Classic turn.`,
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
  }

  function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void generateTurn();
  }

  if (!thread) {
    return (
      <section className="classic-thread classic-thread-empty">
        <header className="classic-header">
          <div>
            <button
              className="classic-back"
              onClick={handleBack}
              aria-label="Back to the Pond"
            >
              ← Back to the Pond
            </button>
            <h2>No Classic scene selected</h2>
            <p className="classic-meta">Create a scene to start writing.</p>
          </div>
        </header>
        <div className="classic-empty">
          <button type="button" onClick={() => nav.createClassicThread()}>
            + Start a Classic scene
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="classic-thread" aria-labelledby="classic-thread-title">
      <header className="classic-header">
        <div>
          <button
            className="classic-back"
            onClick={handleBack}
            aria-label="Back to the Pond"
          >
            ← Back to the Pond
          </button>
          <h2 id="classic-thread-title">{thread.title}</h2>
          <p className="classic-meta">
            Scene with {threadCharacters.map((character) => character.displayName).join(" + ") || "no companions"}
          </p>
        </div>
        <div className="classic-header-tools">
          <span title={activePersona?.summary || ""}>
            {activePersona?.displayName ?? "No persona"}
          </span>
          <span title={threadConnection.summary}>{threadConnection.label}</span>
        </div>
      </header>

      <form className="classic-scene" onSubmit={handleGenerate}>
        <label htmlFor="classic-scene-text">Scene</label>
        <textarea
          id="classic-scene-text"
          value={sceneText}
          onBlur={saveSceneDraft}
          onChange={(event) =>
            setSceneDraft({
              threadId: thread.id,
              body: event.target.value,
            })
          }
          placeholder="Set the scene, the location, and what is happening now..."
        />
        <div className="classic-actions">
          <button type="submit" disabled={!canGenerate}>
            {isGenerating ? "Generating" : "Generate turn"}
          </button>
          <button
            type="button"
            onClick={() => nav.clearClassicThreadEntries(thread.id)}
            disabled={thread.entries.length === 0}
          >
            Clear turns
          </button>
        </div>
        <p className="classic-hint">
          {generationNotice ||
            (isGenerating
              ? `${generationRuntime.label} is continuing the scene.`
              : "Classic uses the same provider boundary as Messenger.")}
        </p>
      </form>

      <div className="classic-entries" aria-label="Classic scene turns">
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
          <p className="classic-empty-note">No turns yet.</p>
        )}
      </div>
    </section>
  );
}
