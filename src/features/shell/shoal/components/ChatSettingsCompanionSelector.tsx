import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { ChatSettingsCompanionMenu } from "./ChatSettingsCompanionMenu";
import { ChatSettingsCompanionNotices } from "./ChatSettingsCompanionNotices";

interface ChatSettingsCompanionSelectorProps {
  activeMessengerThread: boolean;
  characters: CharacterRecord[];
  companionSelectorOpen: boolean;
  missingCompanionCount: number;
  selectedCompanionCount: number;
  selectedCompanionIds: string[];
  selectionLabel: string;
  surfaceLabel?: string;
  onClearMissingCompanions: () => void;
  onCreateCompanion: () => void;
  onSelectorOpenChange: (open: boolean) => void;
  onToggleCompanion: (characterId: string) => void;
}

export function ChatSettingsCompanionSelector({
  activeMessengerThread,
  characters,
  companionSelectorOpen,
  missingCompanionCount,
  selectedCompanionCount,
  selectedCompanionIds,
  selectionLabel,
  surfaceLabel = "Messenger",
  onClearMissingCompanions,
  onCreateCompanion,
  onSelectorOpenChange,
  onToggleCompanion,
}: ChatSettingsCompanionSelectorProps) {
  return (
    <div
      className="chat-settings-field chat-settings-dropdown-field"
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        onSelectorOpenChange(false);
      }}
    >
      <span>Selected companions</span>
      <button
        type="button"
        className="chat-settings-select-button"
        aria-controls="chat-settings-companion-menu"
        aria-expanded={companionSelectorOpen}
        aria-haspopup="listbox"
        disabled={!activeMessengerThread || characters.length === 0}
        onClick={() => onSelectorOpenChange(!companionSelectorOpen)}
      >
        <span>{selectionLabel}</span>
        <small>{selectedCompanionCount}</small>
      </button>
      {companionSelectorOpen && activeMessengerThread && characters.length > 0 && (
        <ChatSettingsCompanionMenu
          characters={characters}
          selectedCompanionIds={selectedCompanionIds}
          onToggleCompanion={onToggleCompanion}
        />
      )}
      <ChatSettingsCompanionNotices
        activeMessengerThread={activeMessengerThread}
        characterCount={characters.length}
        missingCompanionCount={missingCompanionCount}
        selectedCompanionCount={selectedCompanionCount}
        surfaceLabel={surfaceLabel}
        onClearMissingCompanions={onClearMissingCompanions}
        onCreateCompanion={onCreateCompanion}
      />
    </div>
  );
}
