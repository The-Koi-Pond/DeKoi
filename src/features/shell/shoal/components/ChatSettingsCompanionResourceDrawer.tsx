import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsCompanionResourceModel } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsCompanionResourceDrawerProps {
  activeMessengerThread: boolean;
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  model: ChatSettingsCompanionResourceModel;
  onClearMissingCompanions: () => void;
  onCreateCompanion: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
}

export function ChatSettingsCompanionResourceDrawer({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  model,
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
      missingCompanionCount={model.missingCompanionCount}
      open={model.open}
      selectedCompanionCount={model.selectedCompanionCount}
      selectedCompanionIds={model.selectedCompanionIds}
      selectionLabel={model.selectionLabel}
      summary={model.summary}
      onClearMissingCompanions={onClearMissingCompanions}
      onCreateCompanion={onCreateCompanion}
      onSelectorOpenChange={onSelectorOpenChange}
      onToggle={onToggle}
      onToggleCompanion={onToggleCompanion}
    />
  );
}
