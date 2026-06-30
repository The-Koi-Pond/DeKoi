import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import { ChatSettingsLorebooksDrawer } from "./ChatSettingsLorebooksDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsViewModel } from "../lib/chat-settings-view-model";
import type { ShoalRailProps } from "../types";

interface ChatSettingsResourceDrawersProps {
  activeMessengerThread: boolean;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  lorebooks: ShoalRailProps["nav"]["lorebooks"];
  openDrawers: Record<ChatSettingsDrawerId, boolean>;
  viewModel: ChatSettingsViewModel;
  onClearMissingCompanions: () => void;
  onClearMissingLorebooks: () => void;
  onCreateCompanion: () => void;
  onCreateLorebook: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

type ChatSettingsCompanionResourceDrawerProps = Omit<
  ChatSettingsResourceDrawersProps,
  | "lorebooks"
  | "onClearMissingLorebooks"
  | "onCreateLorebook"
  | "onToggleLorebook"
>;

export function ChatSettingsCompanionResourceDrawer({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  openDrawers,
  viewModel,
  onClearMissingCompanions,
  onCreateCompanion,
  onSelectorOpenChange,
  onToggle,
  onToggleCompanion,
}: ChatSettingsCompanionResourceDrawerProps) {
  return (
    <ChatSettingsCompanionsDrawer
      activeMessengerThread={activeMessengerThread}
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
  );
}

type ChatSettingsLorebookResourceDrawerProps = Omit<
  ChatSettingsResourceDrawersProps,
  | "characters"
  | "companionSelectorOpen"
  | "onClearMissingCompanions"
  | "onCreateCompanion"
  | "onSelectorOpenChange"
  | "onToggleCompanion"
>;

export function ChatSettingsLorebookResourceDrawer({
  activeMessengerThread,
  lorebooks,
  openDrawers,
  viewModel,
  onClearMissingLorebooks,
  onCreateLorebook,
  onToggle,
  onToggleLorebook,
}: ChatSettingsLorebookResourceDrawerProps) {
  return (
    <ChatSettingsLorebooksDrawer
      activeMessengerThread={activeMessengerThread}
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
  );
}
