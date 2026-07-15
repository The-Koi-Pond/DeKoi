import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type {
  NavCatalogState,
  NavLoreRuntimeActions,
  NavMacroVariableActions,
  NavMacroVariableState,
  NavMessengerThreadActions,
  NavSettingsState,
  NavStorageState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";
import type { MessengerModeThread } from "../../../engine/contracts/types/mode-thread";
import {
  getActiveModeBranch,
  getActiveModeBranchMessages,
  getActiveModeMessageVersion,
} from "../../../engine/modes/mode-thread/mode-thread-actions";
import { getProviderConnectionById } from "../../../engine/contracts/types/provider-connection";
import { MESSENGER } from "../../../engine/contracts/constants/surfaces";
import {
  appendMessengerMessages,
  createAnonymousMessengerMessage,
  createPersonaMessengerMessage,
  setMessengerThreadProviderConnection,
} from "../../../engine/modes/messenger/messenger-actions";
import {
  describeGenerationFailureNotice,
  describeGenerationReadinessFailure,
  describeGenerationTransport,
  generateMessengerThreadReply,
  getGenerationConnectionReadiness,
} from "../../runtime";
import { commitGenerationMacroVariableStates } from "../../../engine/macro-variables/macro-variable-actions";
import {
  ChatComposer,
  GenerationNotice,
  getGenerationNoticeAction,
  type GenerationNoticeAction,
} from "../shared";
import { waitForGeneratedTypingDelay } from "../shared/generation-delay";
import { generationOriginStillExists } from "../shared/generation-origin";
import { getInitials } from "./lib/message-view";
import {
  getMessengerThreadReferenceNotices,
  getMessengerThreadReferenceSummary,
  getMessengerThreadSendBlocker,
} from "./lib/thread-reference-summary";
import { MessengerMessageList } from "./components/MessengerMessageList";
import "./messenger-thread.css";

export type MessengerThreadNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "promptPresets" | "providerConnections"
> &
  Pick<
    NavMessengerThreadActions,
    | "createMessengerThread"
    | "updateMessengerThread"
    | "appendMessengerThreadMessages"
    | "messengerPromptPresetRepairNotices"
    | "clearMessengerPromptPresetRepairNotice"
  > &
  Pick<NavLoreRuntimeActions, "getLoreRuntimeState" | "updateLoreRuntimeState"> &
  Pick<NavMacroVariableState, "macroVariableStates"> &
  Pick<NavMacroVariableActions, "updateMacroVariableStates"> &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavStorageState, "storageReady"> &
  Pick<NavThreadState, "modeThreads"> &
  Pick<NavViewActions, "setSideRailView" | "setView"> &
  Pick<NavViewState, "view">;

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface MessengerThreadProps {
  nav: MessengerThreadNav;
  onOpenSideRail?: () => void;
}

export function MessengerThread({ nav, onOpenSideRail }: MessengerThreadProps) {
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const messengerThread =
    nav.modeThreads.find(
      (thread): thread is MessengerModeThread =>
        thread.kind === "messenger" && thread.id === activeThreadId,
    ) ?? null;
  const activeBranch = messengerThread ? getActiveModeBranch(messengerThread) : null;
  const messages = messengerThread ? getActiveModeBranchMessages(messengerThread) : [];
  const [draftState, setDraftState] = useState<{
    body: string;
    threadId: string | null;
  }>({ body: "", threadId: null });
  const [generationState, setGenerationState] = useState<{
    threadId: string | null;
    status: "idle" | "generating" | "warning" | "error";
    message: string;
    action: GenerationNoticeAction | null;
  }>({ threadId: null, status: "idle", message: "", action: null });
  const messengerThreadsRef = useRef(nav.modeThreads);
  const threadCompanions = messengerThread
    ? nav.characters.filter((companion) => activeBranch?.characterIds.includes(companion.id))
    : [];
  const primaryCompanion = threadCompanions[0] ?? null;
  const companionDisplayName =
    threadCompanions.map((companion) => companion.displayName).join(" + ") ||
    messengerThread?.title ||
    "No companion";
  const draft = draftState.threadId === activeThreadId ? draftState.body : "";
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
  const threadReferenceSummary = messengerThread
    ? getMessengerThreadReferenceSummary({
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        promptPresets: nav.promptPresets,
        providerConnections: nav.providerConnections,
        thread: messengerThread,
      })
    : null;
  const threadReferenceNotices = threadReferenceSummary
    ? getMessengerThreadReferenceNotices(threadReferenceSummary)
    : [];
  const promptRepairNotice = activeThreadId
    ? nav.messengerPromptPresetRepairNotices[activeThreadId]
    : null;
  const storageBlocker = nav.storageReady ? "" : "Storage is still loading.";
  const sendBlocker =
    storageBlocker ||
    (threadReferenceSummary ? getMessengerThreadSendBlocker(threadReferenceSummary) : "");
  const canSend =
    !!messengerThread &&
    nav.storageReady &&
    draft.trim().length > 0 &&
    !isGenerating &&
    !sendBlocker;
  const generationTransport = describeGenerationTransport();
  useLayoutEffect(() => {
    messengerThreadsRef.current = nav.modeThreads;
  }, [nav.modeThreads]);

  async function sendDraft() {
    if (!messengerThread) return false;
    if (!nav.storageReady) return false;
    if (isGenerating) return false;

    const trimmedDraft = draft.trim();
    if (!trimmedDraft) return false;
    const sentAt = new Date().toISOString();
    const commitThread =
      nav.modeThreads.find(
        (thread): thread is MessengerModeThread =>
          thread.kind === "messenger" && thread.id === activeThreadId,
      ) ?? null;
    if (!commitThread) return false;
    const commitSendBlocker = getMessengerThreadSendBlocker(
      getMessengerThreadReferenceSummary({
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
    const hasConfiguredConnection =
      !!commitBranch.providerConnectionId &&
      commitBranch.providerConnectionId === commitConnection.id;
    const threadForSend = hasConfiguredConnection
      ? commitThread
      : setMessengerThreadProviderConnection(commitThread, commitConnection.id, sentAt);
    const userMessage = sendPersona
      ? createPersonaMessengerMessage({
          body: trimmedDraft,
          id: createLocalId("messenger-message"),
          versionId: createLocalId("messenger-version"),
          now: sentAt,
          persona: sendPersona,
          thread: threadForSend,
        })
      : createAnonymousMessengerMessage({
          body: trimmedDraft,
          id: createLocalId("messenger-message"),
          versionId: createLocalId("messenger-version"),
          now: sentAt,
          thread: threadForSend,
        });
    const threadWithUserMessage = appendMessengerMessages(threadForSend, [userMessage]);

    nav.updateMessengerThread(threadWithUserMessage);
    setDraftState({ body: "", threadId: activeThreadId });

    setGenerationState({
      threadId: commitThread.id,
      status: "generating",
      message: `Generating through ${sendTransport.label}.`,
      action: null,
    });

    try {
      const result = await generateMessengerThreadReply({
        appSettings: nav.appSettings,
        characters: nav.characters,
        createId: createLocalId,
        fallbackProviderConnectionId: commitConnection.id,
        lorebooks: nav.lorebooks,
        loreRuntimeState: nav.getLoreRuntimeState("mode-branch", activeBranch?.id ?? ""),
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
        thread: threadWithUserMessage,
        userMessage,
      });

      let ownerExists = generationOriginStillExists({
        itemId: userMessage.id,
        selectItems: (thread) => getActiveModeBranchMessages(thread),
        threadId: threadWithUserMessage.id,
        threads: messengerThreadsRef.current,
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
        const typingNames = [
          ...new Set(result.generatedMessages.map((message) => message.author.label)),
        ].join(" + ");
        setGenerationState({
          threadId: commitThread.id,
          status: "generating",
          message: `${typingNames || companionDisplayName} is typing...`,
          action: null,
        });
        await waitForGeneratedTypingDelay(
          result.generatedMessages
            .map((message) => getActiveModeMessageVersion(message).body)
            .join("\n"),
        );
        ownerExists = generationOriginStillExists({
          itemId: userMessage.id,
          selectItems: (thread) => getActiveModeBranchMessages(thread),
          threadId: threadWithUserMessage.id,
          threads: messengerThreadsRef.current,
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
        nav.appendMessengerThreadMessages(threadWithUserMessage.id, result.generatedMessages);
        nav.updateMacroVariableStates((currentStates) =>
          commitGenerationMacroVariableStates({
            ...result.macroVariableCommit,
            createId: createLocalId,
            macroVariableStates: currentStates,
            ownerExists,
          }),
        );
      }
      nav.updateLoreRuntimeState(result.loreRuntimeState, "mode-branch", activeBranch?.id ?? "");

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
                `${result.runtimeLabel} did not return a Messenger reply.`,
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
      const notice = describeGenerationFailureNotice(error, "Messenger generation failed.");
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

  function openMessengerThreadSettings() {
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
      nav.appSettings.sendOnEnterSurface !== MESSENGER
    ) {
      return;
    }

    event.preventDefault();
    void sendDraft();
  }

  if (!messengerThread) {
    return (
      <section className="messenger-thread messenger-thread-empty">
        <div className="empty-thread">
          <button type="button" onClick={() => nav.createMessengerThread()}>
            + Cast a line
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="messenger-thread" aria-labelledby="messenger-contact-name">
      <header className="messenger-contact-header">
        <span className="messenger-contact-avatar" aria-hidden="true">
          {primaryCompanion?.avatarUrl ? (
            <img src={primaryCompanion.avatarUrl} alt="" />
          ) : (
            getInitials(companionDisplayName)
          )}
          <span className="messenger-contact-status" />
        </span>
        <div className="messenger-contact-title">
          <h2 id="messenger-contact-name" title={companionDisplayName}>
            {companionDisplayName}
          </h2>
        </div>
        <button
          type="button"
          className="messenger-thread-settings-button"
          aria-label="Open Messenger thread settings"
          title="Thread settings"
          onClick={openMessengerThreadSettings}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      {threadReferenceNotices.length > 0 && (
        <div className="messenger-thread-notices" aria-label="Messenger thread notices">
          {threadReferenceNotices.map((notice) => (
            <div
              className={`messenger-thread-notice ${notice.tone}`}
              key={notice.id}
              role={notice.tone === "error" ? "alert" : "status"}
            >
              <p>{notice.message}</p>
              <button
                type="button"
                aria-label={`Open settings for ${notice.id}`}
                onClick={openMessengerThreadSettings}
              >
                Open settings
              </button>
            </div>
          ))}
        </div>
      )}
      {promptRepairNotice && (
        <div className="messenger-thread-notices" aria-label="Messenger prompt preset notice">
          <div className="messenger-thread-notice warning" role="status">
            <p>{promptRepairNotice}</p>
            <button
              type="button"
              onClick={() => {
                nav.clearMessengerPromptPresetRepairNotice(messengerThread.id);
                nav.setSideRailView("chat-settings");
              }}
            >
              Review settings
            </button>
          </div>
        </div>
      )}

      <MessengerMessageList
        characters={nav.characters}
        confirmRelease={nav.appSettings.confirmRelease}
        isGenerating={isGenerating}
        messages={messages}
        onUpdateThread={nav.updateMessengerThread}
        personas={nav.personas}
        thread={messengerThread}
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
        ariaLabel="Messenger composer"
        draftAriaLabel="Draft Messenger message"
        disabled={!canSend}
        hint={
          generationNotice ||
          sendBlocker ||
          (isGenerating
            ? generationStatusMessage ||
              `${generationTransport.label} is replying through the provider-neutral path.`
            : nav.appSettings.sendOnEnterSurface === MESSENGER
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
        placeholder="Write a Messenger message..."
        submitBusyLabel="Generating reply"
        submitLabel="Send message"
        value={draft}
      />
    </section>
  );
}
