import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { NewThreadDropdownField } from "./NewThreadDropdownField";

interface NewThreadLorebookDropdownProps {
  labelId: string;
  lorebooks: LorebookRecord[];
  menuId: string;
  open: boolean;
  selectedIds: string[];
  selectionLabel: string;
  onOpenChange: (open: boolean) => void;
  onToggleOpenChange?: (open: boolean) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function NewThreadLorebookDropdown({
  labelId,
  lorebooks,
  menuId,
  open,
  selectedIds,
  selectionLabel,
  onOpenChange,
  onToggleOpenChange,
  onToggleLorebook,
}: NewThreadLorebookDropdownProps) {
  return (
    <NewThreadDropdownField
      count={selectedIds.length}
      disabled={lorebooks.length === 0}
      label="Lorebooks"
      labelId={labelId}
      menuId={menuId}
      open={open}
      selectionLabel={selectionLabel}
      onOpenChange={onOpenChange}
      onToggleOpenChange={onToggleOpenChange}
    >
      {lorebooks.map((lorebook) => {
        const selected = selectedIds.includes(lorebook.id);

        return (
          <label
            className={`new-thread-check${selected ? " on" : ""}`}
            key={lorebook.id}
            role="option"
            aria-selected={selected}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggleLorebook(lorebook.id)}
            />
            <span>
              <b>{lorebook.title}</b>
              <small>{lorebook.summary || "Lorebook"}</small>
            </span>
          </label>
        );
      })}
    </NewThreadDropdownField>
  );
}
