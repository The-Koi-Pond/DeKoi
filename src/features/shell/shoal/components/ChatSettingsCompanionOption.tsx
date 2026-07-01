import type { CharacterRecord } from "../../../../engine/contracts/types/character";

interface ChatSettingsCompanionOptionProps {
  character: CharacterRecord;
  selected: boolean;
  onToggle: () => void;
}

export function ChatSettingsCompanionOption({
  character,
  selected,
  onToggle,
}: ChatSettingsCompanionOptionProps) {
  return (
    <label
      className={`chat-settings-check${selected ? " on" : ""}`}
      role="option"
      aria-selected={selected}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} />
      <span>{character.displayName}</span>
    </label>
  );
}
