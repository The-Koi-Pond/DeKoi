import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsIdentityDrawers } from "./ChatSettingsIdentityDrawers";
import {
  ChatSettingsCompanionResourceDrawer,
  ChatSettingsLorebookResourceDrawer,
} from "./ChatSettingsResourceDrawers";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsPromptControls } from "./ChatSettingsPromptControls";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsMessengerDrawersProps {
  activeMessengerThread: MessengerThread | null;
  activeMessengerThreadId: string | null;
  appSettings: ShoalRailProps["nav"]["appSettings"];
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  personas: ShoalRailProps["nav"]["personas"];
  settingsLabel: string;
  viewModel: ChatSettingsViewModel;
  onClearMissingCompanions: () => void;
  onClearMissingLorebooks: () => void;
  onConnectionChange: (connectionId: string) => void;
  onCreateCompanion: () => void;
  onCreateConnection: () => void;
  onCreateLorebook: () => void;
  onCreateMessengerThread: () => void;
  onPersonaChange: (personaId: string) => void;
  onResolveMissingConnection: (connectionId: string | null) => void;
  onSaveCustomPrompt: (threadId: string, prompt: string) => void;
  onSelectorOpenChange: (open: boolean) => void;
  onSystemPromptModeChange: (mode: MessengerSystemPromptMode) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
  onUpdateAppSettings: ShoalRailProps["nav"]["updateAppSettings"];
}

export function ChatSettingsMessengerDrawers({
  activeMessengerThread,
  activeMessengerThreadId,
  appSettings,
  characters,
  companionSelectorOpen,
  lorebooks,
  openDrawers,
  personas,
  settingsLabel,
  viewModel,
  onClearMissingCompanions,
  onClearMissingLorebooks,
  onConnectionChange,
  onCreateCompanion,
  onCreateConnection,
  onCreateLorebook,
  onCreateMessengerThread,
  onPersonaChange,
  onResolveMissingConnection,
  onSaveCustomPrompt,
  onSelectorOpenChange,
  onSystemPromptModeChange,
  onToggle,
  onToggleCompanion,
  onToggleLorebook,
  onUpdateAppSettings,
}: ChatSettingsMessengerDrawersProps) {
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
        viewModel={viewModel}
        onConnectionChange={onConnectionChange}
        onCreateConnection={onCreateConnection}
        onPersonaChange={onPersonaChange}
        onResolveMissingConnection={onResolveMissingConnection}
        onToggle={onToggle}
      />

      <ChatSettingsCompanionResourceDrawer
        activeMessengerThread={active}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingCompanions={onClearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={onSelectorOpenChange}
        onToggle={onToggle}
        onToggleCompanion={onToggleCompanion}
      />

      <ChatSettingsPromptControls
        key={activeMessengerThreadId ?? "no-messenger-thread"}
        activeMessengerThread={active}
        activeMessengerThreadRecord={activeMessengerThread}
        activeMessengerThreadId={activeMessengerThreadId}
        open={openDrawers.prompt}
        systemPromptMode={viewModel.systemPromptMode}
        onSaveCustomPrompt={onSaveCustomPrompt}
        onSystemPromptModeChange={onSystemPromptModeChange}
        onToggle={onToggle}
      />

      <ChatSettingsLorebookResourceDrawer
        activeMessengerThread={active}
        lorebooks={lorebooks}
        openDrawers={openDrawers}
        viewModel={viewModel}
        onClearMissingLorebooks={onClearMissingLorebooks}
        onCreateLorebook={onCreateLorebook}
        onToggle={onToggle}
        onToggleLorebook={onToggleLorebook}
      />

      <ChatSettingsAdvancedDrawer
        appSettings={appSettings}
        open={openDrawers.advanced}
        settingsLabel={settingsLabel}
        onToggle={onToggle}
        updateAppSettings={onUpdateAppSettings}
      />
    </div>
  );
}
