import type { FormEventHandler } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { NewThreadActions } from "./NewThreadActions";
import { NewThreadConnectionField } from "./NewThreadConnectionField";
import { NewThreadPersonaField } from "./NewThreadPersonaField";
import { NewThreadPopoverFrame } from "./NewThreadPopoverFrame";
import { NewThreadTextField } from "./NewThreadTextField";
import { NewRoleplayThreadResourceFields } from "./NewRoleplayThreadResourceFields";

interface NewRoleplayThreadPopoverProps {
  characterIds: string[];
  characters: CharacterRecord[];
  companionLabel: string;
  companionMenuOpen: boolean;
  connectionId: string;
  connections: ProviderConnectionRecord[];
  lorebookIds: string[];
  lorebookLabel: string;
  lorebookMenuOpen: boolean;
  lorebooks: LorebookRecord[];
  name: string;
  namePlaceholder: string;
  personaId: string;
  personas: PersonaRecord[];
  onClose: () => void;
  onCompanionMenuOpenChange: (open: boolean) => void;
  onConnectionChange: (connectionId: string) => void;
  onLorebookMenuOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onPersonaChange: (personaId: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggleCharacter: (characterId: string) => void;
  onToggleLorebook: (lorebookId: string) => void;
}

export function NewRoleplayThreadPopover({
  characterIds,
  characters,
  companionLabel,
  companionMenuOpen,
  connectionId,
  connections,
  lorebookIds,
  lorebookLabel,
  lorebookMenuOpen,
  lorebooks,
  name,
  namePlaceholder,
  personaId,
  personas,
  onClose,
  onCompanionMenuOpenChange,
  onConnectionChange,
  onLorebookMenuOpenChange,
  onNameChange,
  onPersonaChange,
  onSubmit,
  onToggleCharacter,
  onToggleLorebook,
}: NewRoleplayThreadPopoverProps) {
  return (
    <NewThreadPopoverFrame
      closeLabel="Close new Roleplay thread"
      id="new-roleplay-thread-popover"
      title="New Roleplay Thread"
      titleId="new-roleplay-thread-title"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <NewThreadTextField
        label="Thread Name"
        placeholder={namePlaceholder}
        value={name}
        onChange={onNameChange}
      />
      <NewThreadConnectionField
        connections={connections}
        value={connectionId}
        onChange={onConnectionChange}
      />
      <NewThreadPersonaField
        emptyLabel="No persona"
        personas={personas}
        value={personaId}
        onChange={onPersonaChange}
      />
      <NewRoleplayThreadResourceFields
        characterIds={characterIds}
        characters={characters}
        companionLabel={companionLabel}
        companionMenuOpen={companionMenuOpen}
        lorebookIds={lorebookIds}
        lorebookLabel={lorebookLabel}
        lorebookMenuOpen={lorebookMenuOpen}
        lorebooks={lorebooks}
        onCompanionMenuOpenChange={onCompanionMenuOpenChange}
        onLorebookMenuOpenChange={onLorebookMenuOpenChange}
        onToggleCharacter={onToggleCharacter}
        onToggleLorebook={onToggleLorebook}
      />
      <NewThreadActions
        submitDisabled={characterIds.length === 0}
        onClose={onClose}
      />
    </NewThreadPopoverFrame>
  );
}
