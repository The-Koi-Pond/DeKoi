import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { ChatSettingsDrawer, ChatSettingsNotice } from "./ChatSettingsBlocks";
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
          aria-controls="messenger-settings-companion-menu"
          aria-expanded={companionSelectorOpen}
          aria-haspopup="listbox"
          disabled={!activeMessengerThread || characters.length === 0}
          onClick={() => onSelectorOpenChange(!companionSelectorOpen)}
        >
          <span>{selectionLabel}</span>
          <small>{selectedCompanionCount}</small>
        </button>
        {companionSelectorOpen &&
          activeMessengerThread &&
          characters.length > 0 && (
            <div
              className="chat-settings-select-menu"
              id="messenger-settings-companion-menu"
              role="listbox"
              aria-multiselectable="true"
            >
              {characters.map((character) => {
                const selected = selectedCompanionIds.includes(character.id);

                return (
                  <label
                    className={`chat-settings-check${selected ? " on" : ""}`}
                    key={character.id}
                    role="option"
                    aria-selected={selected}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleCompanion(character.id)}
                    />
                    <span>{character.displayName}</span>
                  </label>
                );
              })}
            </div>
          )}
        {missingCompanionCount > 0 && (
          <ChatSettingsNotice
            actionLabel="Clear missing"
            onAction={onClearMissingCompanions}
          >
            {missingCompanionCount} selected companion
            {missingCompanionCount === 1 ? " is" : "s are"} no longer saved.
            Missing companions are skipped when Messenger builds a reply.
          </ChatSettingsNotice>
        )}
        {activeMessengerThread &&
          characters.length === 0 &&
          missingCompanionCount === 0 && (
            <ChatSettingsNotice
              actionLabel="Create companion"
              onAction={onCreateCompanion}
            >
              Create a companion before Messenger can generate replies.
            </ChatSettingsNotice>
          )}
        {activeMessengerThread &&
          characters.length > 0 &&
          selectedCompanionCount === 0 && (
            <p className="chat-settings-empty-line">
              Choose at least one companion before generating replies.
            </p>
          )}
      </div>
    </ChatSettingsDrawer>
  );
}
