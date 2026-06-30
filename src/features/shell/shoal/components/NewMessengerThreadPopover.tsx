import type { FormEventHandler } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { NewThreadActions } from "./NewThreadActions";
import { NewThreadCharacterDropdown } from "./NewThreadCharacterDropdown";
import { NewThreadPopoverFrame } from "./NewThreadPopoverFrame";
import { NewThreadSelectField } from "./NewThreadSelectField";
import { NewThreadTextField } from "./NewThreadTextField";

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
      <NewThreadTextField
        label="Thread Name"
        placeholder={namePlaceholder}
        value={name}
        onChange={onNameChange}
      />
      <NewThreadSelectField
        disabled={connections.length === 0}
        label="Connection"
        value={connectionId}
        onChange={onConnectionChange}
      >
        {connections.map((connection) => (
          <option value={connection.id} key={connection.id}>
            {connection.label}
          </option>
        ))}
      </NewThreadSelectField>
      <NewThreadSelectField
        label="Persona"
        value={personaId}
        onChange={onPersonaChange}
      >
        <option value="">Anonymous</option>
        {personas.map((persona) => (
          <option value={persona.id} key={persona.id}>
            {persona.displayName}
          </option>
        ))}
      </NewThreadSelectField>
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
      <NewThreadActions
        submitDisabled={characterIds.length === 0}
        onClose={onClose}
      />
    </NewThreadPopoverFrame>
  );
}
