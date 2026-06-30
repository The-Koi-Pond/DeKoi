import { useMemo, useState } from "react";
import { MESSENGER, ROLEPLAY } from "../../../../engine/contracts/constants/surfaces";
import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";
import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
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

  const chatSettingsViewModel = useMemo(
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
      <ChatSettingsMessengerDrawers
        activeMessengerThread={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        appSettings={nav.appSettings}
        characters={nav.characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={nav.lorebooks}
        openDrawers={openDrawers}
        personas={nav.personas}
        settingsLabel={settingsLabel}
        viewModel={chatSettingsViewModel}
        onClearMissingCompanions={clearMissingMessengerCompanions}
        onClearMissingLorebooks={clearMissingMessengerLorebooks}
        onConnectionChange={handleMessengerConnectionChange}
        onCreateCompanion={() =>
          nav.setView({ kind: "companions", mode: "new" })
        }
        onCreateConnection={() =>
          nav.setView({ kind: "connections", mode: "new" })
        }
        onCreateLorebook={() =>
          nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
        }
        onCreateMessengerThread={nav.createMessengerThread}
        onPersonaChange={handleMessengerPersonaChange}
        onResolveMissingConnection={resolveMissingMessengerConnection}
        onSaveCustomPrompt={saveCustomMessengerPrompt}
        onSelectorOpenChange={setCompanionSelectorOpen}
        onSystemPromptModeChange={handleMessengerSystemPromptModeChange}
        onToggle={toggleChatSettingsDrawer}
        onToggleCompanion={toggleMessengerCompanion}
        onToggleLorebook={toggleMessengerLorebook}
        onUpdateAppSettings={nav.updateAppSettings}
      />
    </ChatSettingsRailShell>
  );
}
