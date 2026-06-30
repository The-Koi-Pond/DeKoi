import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";

export type PeopleCatalogTab = "companions" | "personas";

export function filterPeopleCatalogCharacters(
  characters: readonly CharacterRecord[],
  normalizedQuery: string,
) {
  if (!normalizedQuery) return characters;

  return characters.filter((character) =>
    [
      character.displayName,
      character.nickname ?? "",
      character.personality,
      character.description,
      character.scenario,
      character.creator,
      character.creatorNotes,
      character.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

export function filterPeopleCatalogPersonas(
  personas: readonly PersonaRecord[],
  normalizedQuery: string,
) {
  if (!normalizedQuery) return personas;

  return personas.filter((persona) =>
    [
      persona.displayName,
      persona.nickname ?? "",
      persona.personality,
      persona.description,
      persona.scenario,
      persona.creator,
      persona.creatorNotes,
      persona.tags.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}
