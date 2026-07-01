import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { NewThreadCharacterDropdown } from "./NewThreadCharacterDropdown";

interface NewMessengerThreadResourceFieldsProps {
  characterIds: string[];
  characters: CharacterRecord[];
  companionLabel: string;
  companionMenuOpen: boolean;
  onCompanionMenuOpenChange: (open: boolean) => void;
  onToggleCharacter: (characterId: string) => void;
}

export function NewMessengerThreadResourceFields({
  characterIds,
  characters,
  companionLabel,
  companionMenuOpen,
  onCompanionMenuOpenChange,
  onToggleCharacter,
}: NewMessengerThreadResourceFieldsProps) {
  return (
    <NewThreadCharacterDropdown
      characters={characters}
      emptyMessage="Add a companion before casting a Messenger thread."
      labelId="new-thread-companions-label"
      menuId="new-thread-companion-menu"
      open={companionMenuOpen}
      selectedIds={characterIds}
      selectionLabel={companionLabel}
      onOpenChange={onCompanionMenuOpenChange}
      onToggleCharacter={onToggleCharacter}
    />
  );
}
