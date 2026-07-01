import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import { NewThreadConnectionField } from "./NewThreadConnectionField";
import { NewThreadPersonaField } from "./NewThreadPersonaField";
import { NewThreadTextField } from "./NewThreadTextField";

interface NewThreadIdentityFieldsProps {
  connectionId: string;
  connections: ProviderConnectionRecord[];
  name: string;
  namePlaceholder: string;
  personaEmptyLabel: string;
  personaId: string;
  personas: PersonaRecord[];
  onConnectionChange: (connectionId: string) => void;
  onNameChange: (name: string) => void;
  onPersonaChange: (personaId: string) => void;
}

export function NewThreadIdentityFields({
  connectionId,
  connections,
  name,
  namePlaceholder,
  personaEmptyLabel,
  personaId,
  personas,
  onConnectionChange,
  onNameChange,
  onPersonaChange,
}: NewThreadIdentityFieldsProps) {
  return (
    <>
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
        emptyLabel={personaEmptyLabel}
        personas={personas}
        value={personaId}
        onChange={onPersonaChange}
      />
    </>
  );
}
