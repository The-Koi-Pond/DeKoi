import type {
  MessengerSystemPromptMode,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import { ChatSettingsAdvancedDrawer } from "./ChatSettingsAdvancedDrawer";
import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import { ChatSettingsConnectionDrawer } from "./ChatSettingsConnectionDrawer";
import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import { ChatSettingsNotice } from "./ChatSettingsBlocks";
import { ChatSettingsPersonaDrawer } from "./ChatSettingsPersonaDrawer";
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
      <ChatSettingsConnectionDrawer
        activeMessengerThread={active}
        connections={viewModel.sanitizedProviderConnections}
        fallbackConnection={viewModel.fallbackConnection}
        fallbackConnectionPrefix={viewModel.fallbackConnectionPrefix}
        hasMissingConnection={viewModel.hasMissingConnection}
        messengerConnectionValue={viewModel.messengerConnectionValue}
        missingConnectionResolution={viewModel.missingConnectionResolution}
        open={openDrawers.connection}
        summary={viewModel.connectionSummary}
        onConnectionChange={onConnectionChange}
        onCreateConnection={onCreateConnection}
        onResolveMissingConnection={onResolveMissingConnection}
        onToggle={onToggle}
      />

      <ChatSettingsPersonaDrawer
        activeMessengerThread={active}
        hasMissingPersona={viewModel.hasMissingPersona}
        open={openDrawers.persona}
        personas={personas}
        selectedPersonaId={viewModel.selectedPersonaId}
        summary={viewModel.personaSummary}
        onPersonaChange={onPersonaChange}
        onToggle={onToggle}
      />

      <ChatSettingsCompanionsDrawer
        activeMessengerThread={active}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        missingCompanionCount={viewModel.missingCompanionCount}
        open={openDrawers.companions}
        selectedCompanionCount={viewModel.selectedCompanionCount}
        selectedCompanionIds={viewModel.selectedCompanionIds}
        selectionLabel={viewModel.companionSelectionLabel}
        summary={viewModel.companionDrawerSummary}
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

      <ChatSettingsLorebooksDrawer
        activeMessengerThread={active}
        lorebooks={lorebooks}
        missingLorebookCount={viewModel.missingLorebookCount}
        open={openDrawers.lorebooks}
        selectedLorebookIds={viewModel.selectedLorebookIds}
        summary={viewModel.lorebookDrawerSummary}
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
