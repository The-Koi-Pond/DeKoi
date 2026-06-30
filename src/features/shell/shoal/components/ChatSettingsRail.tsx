import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
import { ChatSettingsPromptControls } from "./ChatSettingsPromptControls";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";
import { ChatSettingsRailShell } from "./ChatSettingsRailShell";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { useChatSettingsMessengerActions } from "../hooks/use-chat-settings-messenger-actions";
import {
  CHAT_SETTINGS_DRAWER_DEFAULTS,
  type ChatSettingsDrawerId,
} from "../lib/chat-settings-drawers";
import { getChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

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
      <ChatSettingsRailShell
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        settingsLabel={settingsLabel}
        shoalClosed={shoalClosed}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
      >
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
      </ChatSettingsRailShell>
    );
  }

  return (
    <ChatSettingsRailShell
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      settingsLabel={settingsLabel}
      shoalClosed={shoalClosed}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
    >
      <ChatSettingsNameControls
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
    </ChatSettingsRailShell>
  );
}
