import { ChatSettingsMessengerRailContent } from "./ChatSettingsMessengerRailContent";
import { ChatSettingsRailShell } from "./ChatSettingsRailShell";
import { ChatSettingsUnavailableNotice } from "./ChatSettingsUnavailableNotice";
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

  return (
    <ChatSettingsRailShell
      chatSettingsOpen={chatSettingsOpen}
      nav={nav}
      settingsLabel={settingsLabel}
      shoalClosed={shoalClosed}
      onOpenChatSettings={onOpenChatSettings}
      onToggleShoal={onToggleShoal}
    >
      {isMessengerSettings ? (
        <ChatSettingsMessengerRailContent
          activeMessengerThread={activeMessengerThread}
          activeMessengerThreadId={activeMessengerThreadId}
          chatSettingsViewModel={chatSettingsViewModel}
          companionSelectorOpen={companionSelectorOpen}
          nav={nav}
          openDrawers={openDrawers}
          settingsLabel={settingsLabel}
          onClearMissingCompanions={clearMissingMessengerCompanions}
          onClearMissingLorebooks={clearMissingMessengerLorebooks}
          onCloseChatSettings={onCloseChatSettings}
          onConnectionChange={handleMessengerConnectionChange}
          onPersonaChange={handleMessengerPersonaChange}
          onResolveMissingConnection={resolveMissingMessengerConnection}
          onSaveCustomPrompt={saveCustomMessengerPrompt}
          onSelectorOpenChange={setCompanionSelectorOpen}
          onSystemPromptModeChange={handleMessengerSystemPromptModeChange}
          onToggle={toggleChatSettingsDrawer}
          onToggleCompanion={toggleMessengerCompanion}
          onToggleLorebook={toggleMessengerLorebook}
        />
      ) : (
        <ChatSettingsUnavailableNotice
          settingsLabel={settingsLabel}
          onCloseChatSettings={onCloseChatSettings}
        />
      )}
    </ChatSettingsRailShell>
  );
}
