import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { NewThreadSelectField } from "./NewThreadSelectField";

interface NewThreadPersonaFieldProps {
  emptyLabel: string;
  personas: PersonaRecord[];
  value: string;
  onChange: (personaId: string) => void;
}

export function NewThreadPersonaField({
  emptyLabel,
  personas,
  value,
  onChange,
}: NewThreadPersonaFieldProps) {
  return (
    <NewThreadSelectField label="Persona" value={value} onChange={onChange}>
      <option value="">{emptyLabel}</option>
      {personas.map((persona) => (
        <option value={persona.id} key={persona.id}>
          {persona.displayName}
        </option>
      ))}
    </NewThreadSelectField>
  );
}
