import type { FormEventHandler } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import {
  NewThreadActions,
  NewThreadPopoverFrame,
  NewThreadSelectField,
  NewThreadTextField,
} from "./NewThreadPopoverBlocks";
import {
  NewThreadCharacterDropdown,
  NewThreadLorebookDropdown,
} from "./NewThreadDropdowns";

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
        <option value="">No persona</option>
        {personas.map((persona) => (
          <option value={persona.id} key={persona.id}>
            {persona.displayName}
          </option>
        ))}
      </NewThreadSelectField>
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
      <NewThreadActions
        submitDisabled={characterIds.length === 0}
        onClose={onClose}
      />
    </NewThreadPopoverFrame>
  );
}
