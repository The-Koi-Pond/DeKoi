import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";

interface NewThreadLorebookOptionProps {
  lorebook: LorebookRecord;
  selected: boolean;
  onToggle: () => void;
}

export function NewThreadLorebookOption({
  lorebook,
  selected,
  onToggle,
}: NewThreadLorebookOptionProps) {
  return (
    <label
      className={`new-thread-check${selected ? " on" : ""}`}
      role="option"
      aria-selected={selected}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} />
      <span>
        <b>{lorebook.title}</b>
        <small>{lorebook.summary || "Lorebook"}</small>
      </span>
    </label>
  );
}
