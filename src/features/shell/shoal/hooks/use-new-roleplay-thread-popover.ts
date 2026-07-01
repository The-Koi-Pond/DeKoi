import { useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import { toggleSelectedId } from "../lib/toggle-selected-id";
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
  const liveLorebookIds = new Set(lorebooks.map((lorebook) => lorebook.id));
  const selectedRoleplayLorebookIds = newRoleplayLorebookIds.filter((id) =>
    liveLorebookIds.has(id),
  );

  function resetNewRoleplayThreadPopover() {
    setNewRoleplayCharacterIds([]);
    setNewRoleplayName("");
    setNewRoleplayNameEdited(false);
    setNewRoleplayConnectionId("");
    setNewRoleplayPersonaId("");
    setNewRoleplayLorebookIds([]);
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
  }

  function closeNewRoleplayThreadPopover() {
    resetNewRoleplayThreadPopover();
    setNewRoleplayOpen(false);
  }

  function openNewRoleplayThreadPopover() {
    const initialCharacterIds = characters[0] ? [characters[0].id] : [];
    resetNewRoleplayThreadPopover();
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
    updateNewRoleplayCharacterIds(
      toggleSelectedId(newRoleplayCharacterIds, characterId),
    );
  }

  function toggleNewRoleplayLorebook(lorebookId: string) {
    setNewRoleplayLorebookIds((currentIds) =>
      toggleSelectedId(currentIds, lorebookId),
    );
  }

  function handleNewRoleplayNameChange(name: string) {
    setNewRoleplayName(name);
    setNewRoleplayNameEdited(true);
  }

  function handleCreateRoleplayThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newRoleplayCharacterIds.length === 0) return;

    const title =
      newRoleplayName.trim() ||
      labels.getDraftRoleplayName(newRoleplayCharacterIds);
    onCreateRoleplayThread({
      activePersonaId: newRoleplayPersonaId || null,
      characterIds: newRoleplayCharacterIds,
      lorebookIds: selectedRoleplayLorebookIds,
      providerConnectionId: newRoleplayConnectionId || null,
      title,
    });
    closeNewRoleplayThreadPopover();
  }

  return {
    actions: {
      close: closeNewRoleplayThreadPopover,
      open: openNewRoleplayThreadPopover,
      setCompanionMenuOpen: setNewRoleplayCompanionMenuOpen,
      setConnectionId: setNewRoleplayConnectionId,
      setLorebookMenuOpen: setNewRoleplayLorebookMenuOpen,
      setName: handleNewRoleplayNameChange,
      setPersonaId: setNewRoleplayPersonaId,
      submit: handleCreateRoleplayThread,
      toggleCharacter: toggleNewRoleplayCharacter,
      toggleLorebook: toggleNewRoleplayLorebook,
    },
    state: {
      characterIds: newRoleplayCharacterIds,
      companionMenuOpen: newRoleplayCompanionMenuOpen,
      connectionId: newRoleplayConnectionId,
      lorebookIds: selectedRoleplayLorebookIds,
      lorebookMenuOpen: newRoleplayLorebookMenuOpen,
      name: newRoleplayName,
      open: newRoleplayOpen,
      personaId: newRoleplayPersonaId,
    },
  };
}
