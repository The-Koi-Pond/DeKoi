import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import { ChatSettingsPromptDrawer } from "./ChatSettingsPromptDrawer";
import { ChatSettingsPromptEditor } from "./ChatSettingsPromptEditor";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ShoalTopBar } from "./ShoalTopBar";
import { useChatSettingsMessengerActions } from "../hooks/use-chat-settings-messenger-actions";
import { useChatSettingsNameEditor } from "../hooks/use-chat-settings-name-editor";
import { useChatSettingsPromptEditor } from "../hooks/use-chat-settings-prompt-editor";
import {
  CHAT_SETTINGS_DRAWER_DEFAULTS,
  type ChatSettingsDrawerId,
} from "../lib/chat-settings-drawers";
import { getChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalNav, ShoalRailProps } from "../types";

export function ChatSettingsRail({
  chatSettingsOpen,
  nav,
  onCloseChatSettings,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const settingsLabel =
    nav.selectedSurface === ROLEPLAY
      ? "Roleplay Settings"
      : nav.selectedSurface === MESSENGER
        ? "Messenger Settings"
        : "Chat Settings";
  const activeMessengerThreadId =
    nav.view.kind === "messenger" ? nav.view.threadId : null;
  const activeMessengerThread = activeMessengerThreadId
    ? nav.messengerThreads.find((thread) => thread.id === activeMessengerThreadId) ??
      null
    : null;
  const [openDrawers, setOpenDrawers] = useState(CHAT_SETTINGS_DRAWER_DEFAULTS);
  const [companionSelectorOpen, setCompanionSelectorOpen] = useState(false);
  const {
    clearMissingMessengerCompanions,
    clearMissingMessengerLorebooks,
    handleMessengerConnectionChange,
    handleMessengerPersonaChange,
    handleMessengerSystemPromptModeChange,
    resolveMissingMessengerConnection,
    saveCustomMessengerPrompt,
    toggleMessengerCompanion,
    toggleMessengerLorebook,
  } = useChatSettingsMessengerActions({
    activeMessengerThread,
    characters: nav.characters,
    lorebooks: nav.lorebooks,
    onCompanionSelectorOpenChange: setCompanionSelectorOpen,
    onUpdateMessengerThread: nav.updateMessengerThread,
  });

  function toggleChatSettingsDrawer(drawerId: ChatSettingsDrawerId) {
    setOpenDrawers((current) => ({
      ...current,
      [drawerId]: !current[drawerId],
    }));
  }

  const {
    companionDrawerSummary,
    companionSelectionLabel,
    connectionSummary,
    fallbackConnection,
    fallbackConnectionPrefix,
    hasMissingConnection,
    hasMissingPersona,
    lorebookDrawerSummary,
    messengerConnectionValue,
    missingCompanionCount,
    missingConnectionResolution,
    missingLorebookCount,
    personaSummary,
    sanitizedProviderConnections,
    selectedCompanionCount,
    selectedCompanionIds,
    selectedLorebookIds,
    selectedPersonaId,
    systemPromptMode,
  } = useMemo(
    () =>
      getChatSettingsViewModel({
        activeMessengerThread,
        appSettings: nav.appSettings,
        characters: nav.characters,
        lorebooks: nav.lorebooks,
        personas: nav.personas,
        providerConnections: nav.providerConnections,
      }),
    [
      activeMessengerThread,
      nav.appSettings,
      nav.characters,
      nav.lorebooks,
      nav.personas,
      nav.providerConnections,
    ],
  );

  if (nav.selectedSurface !== MESSENGER) {
    return (
      <aside
        className="shoal chat-settings-shoal"
        aria-label={`The Shoal - ${settingsLabel}`}
      >
        <ShoalTopBar
          chatSettingsOpen={chatSettingsOpen}
          nav={nav}
          onOpenChatSettings={onOpenChatSettings}
          onToggleShoal={onToggleShoal}
          shoalClosed={shoalClosed}
        />
        <div className="shoal-body">
          <ChatSettingsRailHead
            settingsLabel={settingsLabel}
            onCloseChatSettings={onCloseChatSettings}
          />
          <div className="shoal-list chat-settings-list">
            <ChatSettingsNotice>
              Roleplay settings are not ready yet. Open a Messenger thread to
              adjust Messenger-specific connection, persona, companion, prompt,
              and lore settings.
            </ChatSettingsNotice>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="shoal chat-settings-shoal"
      aria-label={`The Shoal - ${settingsLabel}`}
    >
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
        <ChatSettingsRailHeadWithNameEditor
          key={activeMessengerThreadId ?? "no-messenger-thread"}
          activeMessengerThread={activeMessengerThread}
          activeMessengerThreadId={activeMessengerThreadId}
          settingsLabel={settingsLabel}
          onCloseChatSettings={onCloseChatSettings}
          onRenameMessengerThread={nav.renameMessengerThread}
        />
        <div className="shoal-list chat-settings-list">
          {!activeMessengerThread && (
            <ChatSettingsNotice
              actionLabel="New Messenger"
              onAction={() => nav.createMessengerThread()}
            >
              Open or create a Messenger thread to edit connection, persona,
              companion, prompt, and lore settings.
            </ChatSettingsNotice>
          )}
          <ChatSettingsConnectionDrawer
            activeMessengerThread={!!activeMessengerThread}
            connections={sanitizedProviderConnections}
            fallbackConnection={fallbackConnection}
            fallbackConnectionPrefix={fallbackConnectionPrefix}
            hasMissingConnection={hasMissingConnection}
            messengerConnectionValue={messengerConnectionValue}
            missingConnectionResolution={missingConnectionResolution}
            open={openDrawers.connection}
            summary={connectionSummary}
            onConnectionChange={handleMessengerConnectionChange}
            onCreateConnection={() =>
              nav.setView({ kind: "connections", mode: "new" })
            }
            onResolveMissingConnection={resolveMissingMessengerConnection}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsPersonaDrawer
            activeMessengerThread={!!activeMessengerThread}
            hasMissingPersona={hasMissingPersona}
            open={openDrawers.persona}
            personas={nav.personas}
            selectedPersonaId={selectedPersonaId}
            summary={personaSummary}
            onPersonaChange={handleMessengerPersonaChange}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsCompanionsDrawer
            activeMessengerThread={!!activeMessengerThread}
            characters={nav.characters}
            companionSelectorOpen={companionSelectorOpen}
            missingCompanionCount={missingCompanionCount}
            open={openDrawers.companions}
            selectedCompanionCount={selectedCompanionCount}
            selectedCompanionIds={selectedCompanionIds}
            selectionLabel={companionSelectionLabel}
            summary={companionDrawerSummary}
            onClearMissingCompanions={clearMissingMessengerCompanions}
            onCreateCompanion={() =>
              nav.setView({ kind: "companions", mode: "new" })
            }
            onSelectorOpenChange={setCompanionSelectorOpen}
            onToggle={toggleChatSettingsDrawer}
            onToggleCompanion={toggleMessengerCompanion}
          />

          <ChatSettingsPromptControls
            key={activeMessengerThreadId ?? "no-messenger-thread"}
            activeMessengerThread={!!activeMessengerThread}
            activeMessengerThreadRecord={activeMessengerThread}
            activeMessengerThreadId={activeMessengerThreadId}
            open={openDrawers.prompt}
            systemPromptMode={systemPromptMode}
            onSaveCustomPrompt={saveCustomMessengerPrompt}
            onSystemPromptModeChange={handleMessengerSystemPromptModeChange}
            onToggle={toggleChatSettingsDrawer}
          />

          <ChatSettingsLorebooksDrawer
            activeMessengerThread={!!activeMessengerThread}
            lorebooks={nav.lorebooks}
            missingLorebookCount={missingLorebookCount}
            open={openDrawers.lorebooks}
            selectedLorebookIds={selectedLorebookIds}
            summary={lorebookDrawerSummary}
            onClearMissingLorebooks={clearMissingMessengerLorebooks}
            onCreateLorebook={() =>
              nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
            }
            onToggle={toggleChatSettingsDrawer}
            onToggleLorebook={toggleMessengerLorebook}
          />

          <ChatSettingsAdvancedDrawer
            appSettings={nav.appSettings}
            open={openDrawers.advanced}
            settingsLabel={settingsLabel}
            onToggle={toggleChatSettingsDrawer}
            updateAppSettings={nav.updateAppSettings}
          />
        </div>
      </div>
    </aside>
  );
}

interface ChatSettingsRailHeadWithNameEditorProps {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  settingsLabel: string;
  onCloseChatSettings: () => void;
  onRenameMessengerThread: ShoalNav["renameMessengerThread"];
}

function ChatSettingsRailHeadWithNameEditor({
  activeMessengerThread,
  activeMessengerThreadId,
  settingsLabel,
  onCloseChatSettings,
  onRenameMessengerThread,
}: ChatSettingsRailHeadWithNameEditorProps) {
  const {
    activeChatName,
    activeChatNameEditor,
    cancelChatNameEdit,
    saveChatName,
    startChatNameEdit,
    updateChatNameValue,
  } = useChatSettingsNameEditor({
    activeMessengerThread,
    activeMessengerThreadId,
    onRenameMessengerThread,
  });

  return (
    <ChatSettingsRailHead
      activeChatName={activeChatName}
      chatNameDisabled={!activeMessengerThread}
      chatNameEditing={activeChatNameEditor.editing}
      chatNameValue={activeChatNameEditor.value}
      settingsLabel={settingsLabel}
      showChatNameEditor
      onCancelChatNameEdit={cancelChatNameEdit}
      onChatNameValueChange={updateChatNameValue}
      onCloseChatSettings={onCloseChatSettings}
      onSaveChatName={saveChatName}
      onStartChatNameEdit={startChatNameEdit}
    />
  );
}

interface ChatSettingsPromptControlsProps {
  activeMessengerThread: boolean;
  activeMessengerThreadRecord: MessengerThread | null;
  activeMessengerThreadId: string | null;
  open: boolean;
  systemPromptMode: MessengerSystemPromptMode;
  onSaveCustomPrompt: (prompt: string) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
}

function ChatSettingsPromptControls({
  activeMessengerThread,
  activeMessengerThreadRecord,
  activeMessengerThreadId,
  open,
  systemPromptMode,
  onSaveCustomPrompt,
  onSystemPromptModeChange,
  onToggle,
}: ChatSettingsPromptControlsProps) {
  const {
    activePromptEditor,
    closePromptEditor,
    openPromptEditor,
    savePromptEditor,
    updatePromptEditorValue,
  } = useChatSettingsPromptEditor({
    activeMessengerThread: activeMessengerThreadRecord,
    activeMessengerThreadId,
    onSaveCustomPrompt,
  });

  return (
    <>
      <ChatSettingsPromptDrawer
        activeMessengerThread={activeMessengerThread}
        open={open}
        systemPromptMode={systemPromptMode}
        onOpenPromptEditor={openPromptEditor}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
      />
      <ChatSettingsPromptEditor
        open={activePromptEditor.open && activeMessengerThread}
        value={activePromptEditor.value}
        onClose={closePromptEditor}
        onSave={savePromptEditor}
        onValueChange={updatePromptEditorValue}
      />
    </>
  );
}
