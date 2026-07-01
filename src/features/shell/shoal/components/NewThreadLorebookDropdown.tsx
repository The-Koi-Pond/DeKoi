import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { NewThreadDropdownField } from "./NewThreadDropdownField";
import { NewThreadLorebookOption } from "./NewThreadLorebookOption";

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
      {lorebooks.map((lorebook) => (
        <NewThreadLorebookOption
          key={lorebook.id}
          lorebook={lorebook}
          selected={selectedIds.includes(lorebook.id)}
          onToggle={() => onToggleLorebook(lorebook.id)}
        />
      ))}
    </NewThreadDropdownField>
  );
}
