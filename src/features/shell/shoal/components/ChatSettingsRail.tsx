import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";
import { ChatSettingsNameControls } from "./ChatSettingsNameControls";
import { ChatSettingsRailHead } from "./ChatSettingsRailHead";
import { ChatSettingsRailShell } from "./ChatSettingsRailShell";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { useChatSettingsRailController } from "../hooks/use-chat-settings-rail-controller";
import type { ShoalRailProps } from "../types";

export function ChatSettingsRail({
  chatSettingsOpen,
  nav,
  onCloseChatSettings,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: ShoalRailProps) {
  const {
    activeMessengerThread,
    activeMessengerThreadId,
    chatSettingsViewModel,
    companionSelectorOpen,
    isMessengerSettings,
    openDrawers,
    settingsLabel,
    clearMissingMessengerCompanions,
    clearMissingMessengerLorebooks,
    handleMessengerConnectionChange,
    handleMessengerPersonaChange,
    handleMessengerSystemPromptModeChange,
    resolveMissingMessengerConnection,
    saveCustomMessengerPrompt,
    setCompanionSelectorOpen,
    toggleChatSettingsDrawer,
    toggleMessengerCompanion,
    toggleMessengerLorebook,
  } = useChatSettingsRailController({ nav });

  if (!isMessengerSettings) {
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
