import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsIdentityDrawers } from "./ChatSettingsIdentityDrawers";
import { ChatSettingsMessengerResourceSection } from "./ChatSettingsMessengerResourceSection";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import type {
  ChatSettingsMessengerActionGroup,
  ChatSettingsMessengerSettings,
} from "../lib/chat-settings-controller-groups";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerDrawersProps {
  actions: ChatSettingsMessengerActionGroup;
  appSettings: ShoalRailProps["nav"]["appSettings"];
  characters: ShoalRailProps["nav"]["characters"];
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  personas: ShoalRailProps["nav"]["personas"];
  settings: ChatSettingsMessengerSettings;
  settingsLabel: string;
  onCreateCompanion: () => void;
  onCreateConnection: () => void;
  onCreateLorebook: () => void;
  onCreateMessengerThread: () => void;
  onUpdateAppSettings: ShoalRailProps["nav"]["updateAppSettings"];
}

export function ChatSettingsMessengerDrawers({
  actions,
  appSettings,
  characters,
  lorebooks,
  personas,
  settings,
  settingsLabel,
  onCreateCompanion,
  onCreateConnection,
  onCreateLorebook,
  onCreateMessengerThread,
  onUpdateAppSettings,
}: ChatSettingsMessengerDrawersProps) {
  const {
    activeMessengerThread,
    activeMessengerThreadId,
    chatSettingsViewModel,
    companionSelectorOpen,
    openDrawers,
  } = settings;
  const active = !!activeMessengerThread;

  return (
    <div className="shoal-list chat-settings-list">
      {!activeMessengerThread && (
        <ChatSettingsNotice
          actionLabel="New Messenger"
          onAction={onCreateMessengerThread}
        >
          Open or create a Messenger thread to edit connection, persona,
          companion, prompt, and lore settings.
        </ChatSettingsNotice>
      )}
      <ChatSettingsIdentityDrawers
        activeMessengerThread={active}
        openDrawers={openDrawers}
        personas={personas}
        viewModel={chatSettingsViewModel}
        onConnectionChange={actions.identity.onConnectionChange}
        onCreateConnection={onCreateConnection}
        onPersonaChange={actions.identity.onPersonaChange}
        onResolveMissingConnection={actions.identity.onResolveMissingConnection}
        onToggle={actions.drawers.onToggle}
      />

      <ChatSettingsMessengerResourceSection
        actions={actions}
        activeMessengerThread={active}
        activeMessengerThreadRecord={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        lorebooks={lorebooks}
        openDrawers={openDrawers}
        onCreateCompanion={onCreateCompanion}
        onCreateLorebook={onCreateLorebook}
        viewModel={chatSettingsViewModel}
      />

      <ChatSettingsAdvancedDrawer
        appSettings={appSettings}
        open={openDrawers.advanced}
        settingsLabel={settingsLabel}
        onToggle={actions.drawers.onToggle}
        updateAppSettings={onUpdateAppSettings}
      />
    </div>
  );
}
