import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";

interface PeoplePersonaCatalogListProps {
  activePersonaId: string | null;
  filteredPersonas: readonly PersonaRecord[];
  personas: PersonaRecord[];
  onOpenPersona: (personaId: string) => void;
}

export function PeoplePersonaCatalogList({
  activePersonaId,
  filteredPersonas,
  personas,
  onOpenPersona,
}: PeoplePersonaCatalogListProps) {
  return (
    <>
      <div className="group-label people-label">
        <span>Personas</span>
        <span className="count-bubble">{personas.length}</span>
      </div>
      {filteredPersonas.map((persona) => (
        <CatalogRailCard
          key={persona.id}
          active={persona.id === activePersonaId}
          avatarUrl={persona.avatarUrl}
          initials={getMessengerThreadInitials(persona.displayName)}
          name={persona.displayName}
          sub={persona.personality || persona.nickname || "No personality yet."}
          tone="jade"
          onOpen={() => onOpenPersona(persona.id)}
        />
      ))}
    </>
  );
}
