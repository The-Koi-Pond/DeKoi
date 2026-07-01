import type { CharacterRecord } from "../../../../engine/contracts/types/character";

interface NewThreadCharacterOptionProps {
  character: CharacterRecord;
  selected: boolean;
  onToggle: () => void;
}

export function NewThreadCharacterOption({
  character,
  selected,
  onToggle,
}: NewThreadCharacterOptionProps) {
  return (
    <label
      className={`new-thread-check${selected ? " on" : ""}`}
      role="option"
      aria-selected={selected}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} />
      <span>
        <b>{character.displayName}</b>
        <small>{character.nickname || character.personality || "Companion"}</small>
      </span>
    </label>
  );
}
