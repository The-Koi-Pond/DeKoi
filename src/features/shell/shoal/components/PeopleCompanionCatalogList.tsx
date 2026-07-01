import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";

interface PeopleCompanionCatalogListProps {
  activeCharacterId: string | null;
  characters: CharacterRecord[];
  filteredCharacters: readonly CharacterRecord[];
  onOpenCharacter: (characterId: string) => void;
}

export function PeopleCompanionCatalogList({
  activeCharacterId,
  characters,
  filteredCharacters,
  onOpenCharacter,
}: PeopleCompanionCatalogListProps) {
  return (
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
  );
}
