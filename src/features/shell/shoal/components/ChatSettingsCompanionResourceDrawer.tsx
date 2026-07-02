import { ChatSettingsCompanionsDrawer } from "./ChatSettingsCompanionsDrawer";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";
import type { ChatSettingsCompanionResourceModel } from "../lib/chat-settings-resource-drawer-models";
import type { ShoalRailProps } from "../types";

interface ChatSettingsCompanionResourceDrawerProps {
  characters: ShoalRailProps["nav"]["characters"];
  companionSelectorOpen: boolean;
  model: ChatSettingsCompanionResourceModel;
  surfaceLabel?: string;
  onClearMissingCompanions: () => void;
  onCreateCompanion: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
}

export function ChatSettingsCompanionResourceDrawer({
  characters,
  companionSelectorOpen,
  model,
  surfaceLabel = "Messenger",
  onClearMissingCompanions,
  onCreateCompanion,
  onSelectorOpenChange,
  onToggle,
  onToggleCompanion,
}: ChatSettingsCompanionResourceDrawerProps) {
  return (
    <ChatSettingsCompanionsDrawer
      activeMessengerThread={model.activeMessengerThread}
      characters={characters}
      companionSelectorOpen={companionSelectorOpen}
      missingCompanionCount={model.missingCompanionCount}
      open={model.open}
      selectedCompanionCount={model.selectedCompanionCount}
      selectedCompanionIds={model.selectedCompanionIds}
      selectionLabel={model.selectionLabel}
      summary={model.summary}
      surfaceLabel={surfaceLabel}
      onClearMissingCompanions={onClearMissingCompanions}
      onCreateCompanion={onCreateCompanion}
      onSelectorOpenChange={onSelectorOpenChange}
      onToggle={onToggle}
      onToggleCompanion={onToggleCompanion}
    />
  );
}
