import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { NewThreadCharacterOption } from "./NewThreadCharacterOption";
import { NewThreadDropdownField } from "./NewThreadDropdownField";

interface NewThreadCharacterDropdownProps {
  characters: CharacterRecord[];
  emptyMessage: string;
  labelId: string;
  menuId: string;
  open: boolean;
  selectedIds: string[];
  selectionLabel: string;
  onOpenChange: (open: boolean) => void;
  onToggleOpenChange?: (open: boolean) => void;
  onToggleCharacter: (characterId: string) => void;
}

export function NewThreadCharacterDropdown({
  characters,
  emptyMessage,
  labelId,
  menuId,
  open,
  selectedIds,
  selectionLabel,
  onOpenChange,
  onToggleOpenChange,
  onToggleCharacter,
}: NewThreadCharacterDropdownProps) {
  return (
    <>
      <NewThreadDropdownField
        count={selectedIds.length}
        disabled={characters.length === 0}
        label="Companions"
        labelId={labelId}
        menuId={menuId}
        open={open}
        selectionLabel={selectionLabel}
        onOpenChange={onOpenChange}
        onToggleOpenChange={onToggleOpenChange}
      >
        {characters.map((character) => (
          <NewThreadCharacterOption
            character={character}
            key={character.id}
            selected={selectedIds.includes(character.id)}
            onToggle={() => onToggleCharacter(character.id)}
          />
        ))}
      </NewThreadDropdownField>
      {characters.length === 0 && <p className="new-thread-empty">{emptyMessage}</p>}
    </>
  );
}
