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
      onClearMissingCompanions={actions.resources.clearMissingCompanions}
      onClearMissingLorebooks={actions.resources.clearMissingLorebooks}
      onConnectionChange={actions.identity.onConnectionChange}
      onCreateCompanion={() => nav.setView({ kind: "companions", mode: "new" })}
      onCreateConnection={() =>
        nav.setView({ kind: "connections", mode: "new" })
      }
      onCreateLorebook={() =>
        nav.setView({ kind: "lorebooks", mode: "new-lorebook" })
      }
      onCreateMessengerThread={nav.createMessengerThread}
      onPersonaChange={actions.identity.onPersonaChange}
      onResolveMissingConnection={actions.identity.onResolveMissingConnection}
      onSaveCustomPrompt={actions.prompt.onSaveCustomPrompt}
      onSelectorOpenChange={actions.resources.onSelectorOpenChange}
      onSystemPromptModeChange={actions.prompt.onSystemPromptModeChange}
      onToggle={actions.drawers.onToggle}
      onToggleCompanion={actions.resources.onToggleCompanion}
      onToggleLorebook={actions.resources.onToggleLorebook}
      onUpdateAppSettings={nav.updateAppSettings}
    />
  );
}
