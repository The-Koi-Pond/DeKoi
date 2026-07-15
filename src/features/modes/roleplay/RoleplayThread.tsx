import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  appendRoleplayMessages,
  createPersonaRoleplayMessage,
  createSystemRoleplayMessage,
} from "../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayModeThread } from "../../../engine/contracts/types/mode-thread";
import {
  getActiveModeBranch,
  getActiveModeBranchMessages,
} from "../../../engine/modes/mode-thread/mode-thread-actions";
import { getProviderConnectionById } from "../../../engine/contracts/types/provider-connection";
import { ROLEPLAY } from "../../../engine/contracts/constants/surfaces";
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
import { getInitials } from "./lib/message-view";
import {
  getRoleplayThreadReferenceNotices,
  getRoleplayThreadReferenceSummary,
  getRoleplayThreadSendBlocker,
} from "./lib/thread-reference-summary";
import { RoleplayEntryList } from "./components/RoleplayEntryList";
import "./roleplay-thread.css";

export type RoleplayThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "promptPresets" | "providerConnections"
> &
  Pick<
    NavRoleplayThreadActions,
    | "createRoleplayThread"
    | "updateRoleplayThread"
    | "appendRoleplayThreadEntries"
    | "roleplayPromptPresetRepairNotices"
    | "clearRoleplayPromptPresetRepairNotice"
  > &
  Pick<NavLoreRuntimeActions, "getLoreRuntimeState" | "updateLoreRuntimeState"> &
  Pick<NavMacroVariableState, "macroVariableStates"> &
  Pick<NavMacroVariableActions, "updateMacroVariableStates"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavStorageState, "storageReady"> &
  Pick<NavThreadState, "modeThreads"> &
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
  const thread =
    nav.modeThreads.find(
      (candidate): candidate is RoleplayModeThread =>
        candidate.kind === "roleplay" && candidate.id === activeThreadId,
    ) ?? null;
  const activeBranch = thread ? getActiveModeBranch(thread) : null;
  const messages = thread ? getActiveModeBranchMessages(thread) : [];
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
  const roleplayThreadsRef = useRef(nav.modeThreads);
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
  const threadConnection = getProviderConnectionById(
    activeBranch?.providerConnectionId ?? nav.appSettings.activeMessengerConnectionId,
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
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        thread,
      })
    : null;
  const threadReferenceNotices = threadReferenceSummary
    ? getRoleplayThreadReferenceNotices(threadReferenceSummary)
    : [];
  const promptRepairNotice = activeThreadId
    ? nav.roleplayPromptPresetRepairNotices[activeThreadId]
    : null;
  const storageBlocker = nav.storageReady ? "" : "Storage is still loading.";
  const sendBlocker =
    storageBlocker ||
    (threadReferenceSummary ? getRoleplayThreadSendBlocker(threadReferenceSummary) : "");
  const canSend =
    !!thread && nav.storageReady && draft.trim().length > 0 && !isGenerating && !sendBlocker;
  const castCompanions = activeBranch
    ? nav.characters.filter((companion) => activeBranch.characterIds.includes(companion.id))
    : [];
  const activePersona = activeBranch?.activePersonaId
    ? (nav.personas.find((persona) => persona.id === activeBranch.activePersonaId) ?? null)
    : null;

  useLayoutEffect(() => {
    roleplayThreadsRef.current = nav.modeThreads;
  }, [nav.modeThreads]);

  async function sendDraft() {
    if (!thread) return false;
    if (!nav.storageReady) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    const sentAt = new Date().toISOString();
    const commitThread =
      nav.modeThreads.find(
        (candidate): candidate is RoleplayModeThread =>
          candidate.kind === "roleplay" && candidate.id === activeThreadId,
      ) ?? null;
    if (!commitThread) return false;
    const commitSendBlocker = getRoleplayThreadSendBlocker(
      getRoleplayThreadReferenceSummary({
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
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
      getActiveModeBranch(commitThread).providerConnectionId ??
        nav.appSettings.activeMessengerConnectionId,
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
    const commitBranch = getActiveModeBranch(commitThread);
    const sendPersona = commitBranch.activePersonaId
      ? (nav.personas.find((persona) => persona.id === commitBranch.activePersonaId) ?? null)
      : null;
    const userMessage = sendPersona
      ? createPersonaRoleplayMessage({
          body: trimmedDraft,
          id: createLocalId("roleplay-message"),
          versionId: createLocalId("roleplay-version"),
          now: sentAt,
          persona: sendPersona,
          thread: commitThread,
        })
      : createSystemRoleplayMessage({
          body: trimmedDraft,
          id: createLocalId("roleplay-message"),
          versionId: createLocalId("roleplay-version"),
          now: sentAt,
          thread: commitThread,
        });
    const threadWithUserEntry = appendRoleplayMessages(commitThread, [userMessage]);

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
        loreRuntimeState: nav.getLoreRuntimeState("mode-branch", commitBranch.id),
        macroVariableStates: nav.macroVariableStates,
        now: sentAt,
        parameters: {
          temperature: nav.appSettings.defaultTemperature / 100,
          maxTokens: nav.appSettings.defaultMaxTokens,
          topP: nav.appSettings.defaultTopP / 100,
        },
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        thread: threadWithUserEntry,
      });

      const ownerExists = generationOriginStillExists({
        itemId: userMessage.id,
        selectItems: (candidate) => getActiveModeBranchMessages(candidate),
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

      if (result.generatedMessages.length > 0) {
        nav.appendRoleplayThreadEntries(threadWithUserEntry.id, result.generatedMessages);
        nav.updateMacroVariableStates((currentStates) =>
          commitGenerationMacroVariableStates({
            ...result.macroVariableCommit,
            createId: createLocalId,
            macroVariableStates: currentStates,
            ownerExists,
          }),
        );
      }
      nav.updateLoreRuntimeState(result.loreRuntimeState, "mode-branch", commitBranch.id);

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
      {promptRepairNotice && (
        <div className="roleplay-thread-notices" aria-label="Roleplay prompt preset notice">
          <div className="roleplay-thread-notice warning" role="status">
            <p>{promptRepairNotice}</p>
            <button
              type="button"
              onClick={() => {
                nav.clearRoleplayPromptPresetRepairNotice(thread.id);
                nav.setSideRailView("chat-settings");
              }}
            >
              Review settings
            </button>
          </div>
        </div>
      )}

      <RoleplayEntryList
        characters={nav.characters}
        confirmRelease={nav.appSettings.confirmRelease}
        generationLabel={generationTransport.label}
        isGenerating={isGenerating}
        messages={messages}
        onUpdateThread={nav.updateRoleplayThread}
        personas={nav.personas}
        thread={thread}
      />

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
