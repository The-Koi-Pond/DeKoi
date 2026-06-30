import { useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";

interface UseNewRoleplayThreadPopoverInput {
  characters: readonly CharacterRecord[];
  defaultMessengerConnectionId: string;
  labels: NewThreadLabels;
  lorebooks: readonly LorebookRecord[];
  onCreateRoleplayThread: ShoalNav["createRoleplayThread"];
  roleplayPersonaId: string;
}

export function useNewRoleplayThreadPopover({
  characters,
  defaultMessengerConnectionId,
  labels,
  lorebooks,
  onCreateRoleplayThread,
  roleplayPersonaId,
}: UseNewRoleplayThreadPopoverInput) {
  const [newRoleplayOpen, setNewRoleplayOpen] = useState(false);
  const [newRoleplayName, setNewRoleplayName] = useState("");
  const [newRoleplayNameEdited, setNewRoleplayNameEdited] = useState(false);
  const [newRoleplayConnectionId, setNewRoleplayConnectionId] = useState("");
  const [newRoleplayPersonaId, setNewRoleplayPersonaId] = useState("");
  const [newRoleplayCharacterIds, setNewRoleplayCharacterIds] = useState<
    string[]
  >([]);
  const [newRoleplayLorebookIds, setNewRoleplayLorebookIds] = useState<string[]>(
    [],
  );
  const [newRoleplayCompanionMenuOpen, setNewRoleplayCompanionMenuOpen] =
    useState(false);
  const [newRoleplayLorebookMenuOpen, setNewRoleplayLorebookMenuOpen] =
    useState(false);

  function openNewRoleplayThreadPopover() {
    const initialCharacterIds = characters[0] ? [characters[0].id] : [];
    setNewRoleplayCharacterIds(initialCharacterIds);
    setNewRoleplayName(labels.getDraftRoleplayName(initialCharacterIds));
    setNewRoleplayNameEdited(false);
    setNewRoleplayConnectionId(defaultMessengerConnectionId);
    setNewRoleplayPersonaId(roleplayPersonaId);
    setNewRoleplayLorebookIds(lorebooks.map((lorebook) => lorebook.id));
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
    setNewRoleplayOpen(true);
  }

  function updateNewRoleplayCharacterIds(characterIds: string[]) {
    setNewRoleplayCharacterIds(characterIds);
    if (!newRoleplayNameEdited) {
      setNewRoleplayName(labels.getDraftRoleplayName(characterIds));
    }
  }

  function toggleNewRoleplayCharacter(characterId: string) {
    const nextIds = newRoleplayCharacterIds.includes(characterId)
      ? newRoleplayCharacterIds.filter((id) => id !== characterId)
      : [...newRoleplayCharacterIds, characterId];
    updateNewRoleplayCharacterIds(nextIds);
  }

  function toggleNewRoleplayLorebook(lorebookId: string) {
    setNewRoleplayLorebookIds((currentIds) =>
      currentIds.includes(lorebookId)
        ? currentIds.filter((id) => id !== lorebookId)
        : [...currentIds, lorebookId],
    );
  }

  function handleCreateRoleplayThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newRoleplayCharacterIds.length === 0) return;

    const title =
      newRoleplayName.trim() || labels.getDraftRoleplayName(newRoleplayCharacterIds);
    onCreateRoleplayThread({
      activePersonaId: newRoleplayPersonaId || null,
      characterIds: newRoleplayCharacterIds,
      lorebookIds: newRoleplayLorebookIds,
      providerConnectionId: newRoleplayConnectionId || null,
      title,
    });
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
    setNewRoleplayOpen(false);
  }

  return {
    handleCreateRoleplayThread,
    newRoleplayCharacterIds,
    newRoleplayCompanionMenuOpen,
    newRoleplayConnectionId,
    newRoleplayLorebookIds,
    newRoleplayLorebookMenuOpen,
    newRoleplayName,
    newRoleplayOpen,
    newRoleplayPersonaId,
    openNewRoleplayThreadPopover,
    setNewRoleplayCompanionMenuOpen,
    setNewRoleplayConnectionId,
    setNewRoleplayLorebookMenuOpen,
    setNewRoleplayName,
    setNewRoleplayNameEdited,
    setNewRoleplayOpen,
    setNewRoleplayPersonaId,
    toggleNewRoleplayCharacter,
    toggleNewRoleplayLorebook,
  };
}
