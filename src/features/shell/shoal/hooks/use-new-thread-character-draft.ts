import { useState } from "react";
import { toggleSelectedId } from "../lib/toggle-selected-id";

interface UseNewThreadCharacterDraftInput {
  getDraftName: (characterIds: string[]) => string;
}

export function useNewThreadCharacterDraft({
  getDraftName,
}: UseNewThreadCharacterDraftInput) {
  const [characterIds, setCharacterIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);

  function resetCharacterDraft() {
    setCharacterIds([]);
    setName("");
    setNameEdited(false);
  }

  function initializeCharacterDraft(initialCharacterIds: string[]) {
    setCharacterIds(initialCharacterIds);
    setName(getDraftName(initialCharacterIds));
    setNameEdited(false);
  }

  function updateCharacterIds(nextCharacterIds: string[]) {
    setCharacterIds(nextCharacterIds);
    if (!nameEdited) {
      setName(getDraftName(nextCharacterIds));
    }
  }

  function toggleCharacter(characterId: string) {
    updateCharacterIds(toggleSelectedId(characterIds, characterId));
  }

  function updateName(nextName: string) {
    setName(nextName);
    setNameEdited(true);
  }

  function getTitle() {
    return name.trim() || getDraftName(characterIds);
  }

  return {
    characterIds,
    getTitle,
    initializeCharacterDraft,
    name,
    resetCharacterDraft,
    toggleCharacter,
    updateName,
  };
}
