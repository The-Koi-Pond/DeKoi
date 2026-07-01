import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { ChatSettingsDrawer } from "./ChatSettingsBlocks";
import { ChatSettingsCompanionSelector } from "./ChatSettingsCompanionSelector";
import type { ChatSettingsDrawerId } from "../lib/chat-settings-drawers";

interface ChatSettingsCompanionsDrawerProps {
  activeMessengerThread: boolean;
  characters: CharacterRecord[];
  companionSelectorOpen: boolean;
  missingCompanionCount: number;
  open: boolean;
  selectedCompanionCount: number;
  selectedCompanionIds: string[];
  selectionLabel: string;
  summary: string;
  surfaceLabel?: string;
  onClearMissingCompanions: () => void;
  onCreateCompanion: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggle: (drawerId: ChatSettingsDrawerId) => void;
  onToggleCompanion: (characterId: string) => void;
}

export function ChatSettingsCompanionsDrawer({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  missingCompanionCount,
  open,
  selectedCompanionCount,
  selectedCompanionIds,
  selectionLabel,
  summary,
  surfaceLabel = "Messenger",
  onClearMissingCompanions,
  onCreateCompanion,
  onSelectorOpenChange,
  onToggle,
  onToggleCompanion,
}: ChatSettingsCompanionsDrawerProps) {
  return (
    <ChatSettingsDrawer
      drawerId="companions"
      open={open}
      summary={summary}
      title="Companions"
      onToggle={onToggle}
    >
      <ChatSettingsCompanionSelector
        activeMessengerThread={activeMessengerThread}
        characters={characters}
        companionSelectorOpen={companionSelectorOpen}
        missingCompanionCount={missingCompanionCount}
        selectedCompanionCount={selectedCompanionCount}
        selectedCompanionIds={selectedCompanionIds}
        selectionLabel={selectionLabel}
        surfaceLabel={surfaceLabel}
        onClearMissingCompanions={onClearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
        onSelectorOpenChange={onSelectorOpenChange}
        onToggleCompanion={onToggleCompanion}
      />
    </ChatSettingsDrawer>
  );
}
