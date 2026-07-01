import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import { ChatSettingsCompanionOption } from "./ChatSettingsCompanionOption";

interface ChatSettingsCompanionMenuProps {
  characters: CharacterRecord[];
  selectedCompanionIds: string[];
  onToggleCompanion: (characterId: string) => void;
}

export function ChatSettingsCompanionMenu({
  characters,
  selectedCompanionIds,
  onToggleCompanion,
}: ChatSettingsCompanionMenuProps) {
  return (
    <div
      className="chat-settings-select-menu"
      id="messenger-settings-companion-menu"
      role="listbox"
      aria-multiselectable="true"
    >
      {characters.map((character) => (
        <ChatSettingsCompanionOption
          character={character}
          key={character.id}
          selected={selectedCompanionIds.includes(character.id)}
          onToggle={() => onToggleCompanion(character.id)}
        />
      ))}
    </div>
  );
}
