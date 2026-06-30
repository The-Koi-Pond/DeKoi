import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import { getMessengerThreadInitials } from "../../../modes";
import type { PeopleCatalogTab } from "../lib/people-catalog-view-model";
import { CatalogRailCard } from "./CatalogRailCard";

interface PeopleCatalogListProps {
  activeCharacterId: string | null;
  activePersonaId: string | null;
  activeTab: PeopleCatalogTab;
  characters: CharacterRecord[];
  filteredCharacters: readonly CharacterRecord[];
  filteredPersonas: readonly PersonaRecord[];
  personas: PersonaRecord[];
  onCreate: () => void;
  onOpenCharacter: (characterId: string) => void;
  onOpenPersona: (personaId: string) => void;
}

export function PeopleCatalogList({
  activeCharacterId,
  activePersonaId,
  activeTab,
  characters,
  filteredCharacters,
  filteredPersonas,
  personas,
  onCreate,
  onOpenCharacter,
  onOpenPersona,
}: PeopleCatalogListProps) {
  const isCompanionTab = activeTab === "companions";
  const shownCount = isCompanionTab
    ? filteredCharacters.length
    : filteredPersonas.length;

  return (
    <div className="shoal-list">
      {isCompanionTab ? (
        <>
          <div className="group-label people-label">
            <span>Companions</span>
            <span className="count-bubble">{characters.length}</span>
          </div>
          {filteredCharacters.map((character) => (
            <CatalogRailCard
              key={character.id}
              active={character.id === activeCharacterId}
              avatarUrl={character.avatarUrl}
              initials={getMessengerThreadInitials(character.displayName)}
              name={character.displayName}
              sub={character.personality || character.nickname || "No personality yet."}
              tone="koi"
              onOpen={() => onOpenCharacter(character.id)}
            />
          ))}
        </>
      ) : (
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
      )}
      {shownCount === 0 && (
        <div className="shoal-empty">
          <p>No catalog records match this search.</p>
          <button type="button" onClick={onCreate}>
            ＋ {isCompanionTab ? "Companion" : "Persona"}
          </button>
        </div>
      )}
    </div>
  );
}
