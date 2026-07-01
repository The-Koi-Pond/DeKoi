import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { NewThreadCharacterDropdown } from "./NewThreadCharacterDropdown";
import { NewThreadLorebookDropdown } from "./NewThreadLorebookDropdown";

interface NewRoleplayThreadResourceFieldsProps {
  characterIds: string[];
  characters: CharacterRecord[];
  companionLabel: string;
  companionMenuOpen: boolean;
  lorebookIds: string[];
  lorebookLabel: string;
  lorebookMenuOpen: boolean;
  lorebooks: LorebookRecord[];
  onCompanionMenuOpenChange: (open: boolean) => void;
  onLorebookMenuOpenChange: (open: boolean) => void;
  onToggleCharacter: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function NewRoleplayThreadResourceFields({
  characterIds,
  characters,
  companionLabel,
  companionMenuOpen,
  lorebookIds,
  lorebookLabel,
  lorebookMenuOpen,
  lorebooks,
  onCompanionMenuOpenChange,
  onLorebookMenuOpenChange,
  onToggleCharacter,
  onToggleLorebook,
}: NewRoleplayThreadResourceFieldsProps) {
  return (
    <>
      <NewThreadCharacterDropdown
        characters={characters}
        emptyMessage="Add a companion before starting a Roleplay thread."
        labelId="new-roleplay-companions-label"
        menuId="new-roleplay-companion-menu"
        open={companionMenuOpen}
        selectedIds={characterIds}
        selectionLabel={companionLabel}
        onOpenChange={onCompanionMenuOpenChange}
        onToggleOpenChange={(open) => {
          onLorebookMenuOpenChange(false);
          onCompanionMenuOpenChange(open);
        }}
        onToggleCharacter={onToggleCharacter}
      />
      <NewThreadLorebookDropdown
        labelId="new-roleplay-lorebooks-label"
        lorebooks={lorebooks}
        menuId="new-roleplay-lorebook-menu"
        open={lorebookMenuOpen}
        selectedIds={lorebookIds}
        selectionLabel={lorebookLabel}
        onOpenChange={onLorebookMenuOpenChange}
        onToggleOpenChange={(open) => {
          onCompanionMenuOpenChange(false);
          onLorebookMenuOpenChange(open);
        }}
        onToggleLorebook={onToggleLorebook}
      />
    </>
  );
}
