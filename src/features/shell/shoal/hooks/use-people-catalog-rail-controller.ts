import { useMemo, useState } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import {
  filterPeopleCatalogCharacters,
  filterPeopleCatalogPersonas,
  type PeopleCatalogTab,
} from "../lib/people-catalog-view-model";

export interface PeopleCatalogRailNav {
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  selectedSurface: string;
  setView: (
    view:
      | { kind: "companions"; characterId: string }
      | { kind: "companions"; mode: "new" }
      | { kind: "personas"; personaId: string }
      | { kind: "personas"; mode: "new" },
  ) => void;
  view: {
    characterId?: string;
    kind: string;
    personaId?: string;
  };
}

interface UsePeopleCatalogRailControllerInput {
  nav: PeopleCatalogRailNav;
}

export function usePeopleCatalogRailController({
  nav,
}: UsePeopleCatalogRailControllerInput) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PeopleCatalogTab>("companions");
  const normalizedQuery = query.trim().toLowerCase();
  const activeCharacterId =
    nav.view.kind === "companions" ? nav.view.characterId ?? null : null;
  const activePersonaId =
    nav.view.kind === "personas" ? nav.view.personaId ?? null : null;
  const filteredCharacters = useMemo(
    () => filterPeopleCatalogCharacters(nav.characters, normalizedQuery),
    [nav.characters, normalizedQuery],
  );
  const filteredPersonas = useMemo(
    () => filterPeopleCatalogPersonas(nav.personas, normalizedQuery),
    [nav.personas, normalizedQuery],
  );
  const isCompanionTab = activeTab === "companions";

  function openNew() {
    if (isCompanionTab) {
      nav.setView({ kind: "companions", mode: "new" });
      return;
    }

    nav.setView({ kind: "personas", mode: "new" });
  }

  function openCharacter(characterId: string) {
    nav.setView({ kind: "companions", characterId });
  }

  function openPersona(personaId: string) {
    nav.setView({ kind: "personas", personaId });
  }

  return {
    activeCharacterId,
    activePersonaId,
    activeTab,
    filteredCharacters,
    filteredPersonas,
    query,
    openCharacter,
    openNew,
    openPersona,
    setActiveTab,
    setQuery,
  };
}
