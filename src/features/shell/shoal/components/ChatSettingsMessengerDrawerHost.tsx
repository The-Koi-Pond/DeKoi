import { ChatSettingsMessengerDrawers } from "./ChatSettingsMessengerDrawers";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerDrawerHostProps {
  actions: ChatSettingsMessengerActionGroup;
  nav: ShoalRailProps["nav"];
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
}

export function ChatSettingsMessengerDrawerHost({
  actions,
  nav,
  settings,
  settingsLabel,
}: ChatSettingsMessengerDrawerHostProps) {
  return (
    <ChatSettingsMessengerDrawers
      activeMessengerThread={settings.activeMessengerThread}
      activeMessengerThreadId={settings.activeMessengerThreadId}
      appSettings={nav.appSettings}
      characters={nav.characters}
      companionSelectorOpen={settings.companionSelectorOpen}
      lorebooks={nav.lorebooks}
      openDrawers={settings.openDrawers}
      personas={nav.personas}
      settingsLabel={settingsLabel}
      viewModel={settings.chatSettingsViewModel}
      onClearMissingCompanions={actions.clearMissingCompanions}
      onClearMissingLorebooks={actions.clearMissingLorebooks}
      onConnectionChange={actions.onConnectionChange}
      onCreateCompanion={() => nav.setView({ kind: "companions", mode: "new" })}
      onCreateConnection={() =>
        nav.setView({ kind: "connections", mode: "new" })
      }
      onCreateLorebook={() =>
        nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
      }
      onCreateMessengerThread={nav.createMessengerThread}
      onPersonaChange={actions.onPersonaChange}
      onResolveMissingConnection={actions.onResolveMissingConnection}
      onSaveCustomPrompt={actions.onSaveCustomPrompt}
      onSelectorOpenChange={actions.onSelectorOpenChange}
      onSystemPromptModeChange={actions.onSystemPromptModeChange}
      onToggle={actions.onToggle}
      onToggleCompanion={actions.onToggleCompanion}
      onToggleLorebook={actions.onToggleLorebook}
      onUpdateAppSettings={nav.updateAppSettings}
    />
  );
}
