import type { FormEventHandler } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { NewMessengerThreadResourceFields } from "./NewMessengerThreadResourceFields";
import { NewThreadActions } from "./NewThreadActions";
import { NewThreadIdentityFields } from "./NewThreadIdentityFields";
import { NewThreadPopoverFrame } from "./NewThreadPopoverFrame";

interface NewMessengerThreadPopoverProps {
  characterIds: string[];
  characters: CharacterRecord[];
  companionLabel: string;
  companionMenuOpen: boolean;
  connectionId: string;
  connections: ProviderConnectionRecord[];
  name: string;
  namePlaceholder: string;
  personaId: string;
  personas: PersonaRecord[];
  onClose: () => void;
  onCompanionMenuOpenChange: (open: boolean) => void;
  onConnectionChange: (connectionId: string) => void;
  onNameChange: (name: string) => void;
  onPersonaChange: (personaId: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onToggleCharacter: (characterId: string) => void;
}

export function NewMessengerThreadPopover({
  characterIds,
  characters,
  companionLabel,
  companionMenuOpen,
  connectionId,
  connections,
  name,
  namePlaceholder,
  personaId,
  personas,
  onClose,
  onCompanionMenuOpenChange,
  onConnectionChange,
  onNameChange,
  onPersonaChange,
  onSubmit,
  onToggleCharacter,
}: NewMessengerThreadPopoverProps) {
  return (
    <NewThreadPopoverFrame
      closeLabel="Close new Messenger thread"
      id="new-messenger-thread-popover"
      title="New Messenger Thread"
      titleId="new-messenger-thread-title"
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <NewThreadIdentityFields
        connectionId={connectionId}
        connections={connections}
        name={name}
        namePlaceholder={namePlaceholder}
        personaEmptyLabel="Anonymous"
        personaId={personaId}
        personas={personas}
        onConnectionChange={onConnectionChange}
        onNameChange={onNameChange}
        onPersonaChange={onPersonaChange}
      />
      <NewMessengerThreadResourceFields
        characterIds={characterIds}
        characters={characters}
        companionLabel={companionLabel}
        companionMenuOpen={companionMenuOpen}
        onCompanionMenuOpenChange={onCompanionMenuOpenChange}
        onToggleCharacter={onToggleCharacter}
      />
      <NewThreadActions
        submitDisabled={characterIds.length === 0}
        onClose={onClose}
      />
    </NewThreadPopoverFrame>
  );
}
