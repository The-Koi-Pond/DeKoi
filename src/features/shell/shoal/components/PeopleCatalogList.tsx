import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PeopleCatalogTab } from "../lib/people-catalog-view-model";
import { PeopleCompanionCatalogList } from "./PeopleCompanionCatalogList";
import { PeoplePersonaCatalogList } from "./PeoplePersonaCatalogList";

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
  const shownCount = isCompanionTab ? filteredCharacters.length : filteredPersonas.length;

  return (
    <div className="shoal-list">
      {isCompanionTab ? (
        <PeopleCompanionCatalogList
          activeCharacterId={activeCharacterId}
          characters={characters}
          filteredCharacters={filteredCharacters}
          onOpenCharacter={onOpenCharacter}
        />
      ) : (
        <PeoplePersonaCatalogList
          activePersonaId={activePersonaId}
          filteredPersonas={filteredPersonas}
          personas={personas}
          onOpenPersona={onOpenPersona}
        />
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
