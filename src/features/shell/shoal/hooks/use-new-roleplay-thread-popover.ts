import { useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import { toggleSelectedId } from "../lib/toggle-selected-id";
import type { ShoalNav } from "../types";
import { useNewThreadCharacterDraft } from "./use-new-thread-character-draft";

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
  const [newRoleplayConnectionId, setNewRoleplayConnectionId] = useState("");
  const [newRoleplayPersonaId, setNewRoleplayPersonaId] = useState("");
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
  const characterDraft = useNewThreadCharacterDraft({
    getDraftName: labels.getDraftRoleplayName,
  });

  function resetNewRoleplayThreadPopover() {
    characterDraft.resetCharacterDraft();
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
    characterDraft.initializeCharacterDraft(initialCharacterIds);
    setNewRoleplayConnectionId(defaultMessengerConnectionId);
    setNewRoleplayPersonaId(roleplayPersonaId);
    setNewRoleplayLorebookIds(lorebooks.map((lorebook) => lorebook.id));
    setNewRoleplayCompanionMenuOpen(false);
    setNewRoleplayLorebookMenuOpen(false);
    setNewRoleplayOpen(true);
  }

  function toggleNewRoleplayLorebook(lorebookId: string) {
    setNewRoleplayLorebookIds((currentIds) =>
      toggleSelectedId(currentIds, lorebookId),
    );
  }

  function handleCreateRoleplayThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (characterDraft.characterIds.length === 0) return;

    onCreateRoleplayThread({
      activePersonaId: newRoleplayPersonaId || null,
      characterIds: characterDraft.characterIds,
      lorebookIds: selectedRoleplayLorebookIds,
      providerConnectionId: newRoleplayConnectionId || null,
      title: characterDraft.getTitle(),
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
      setName: characterDraft.updateName,
      setPersonaId: setNewRoleplayPersonaId,
      submit: handleCreateRoleplayThread,
      toggleCharacter: characterDraft.toggleCharacter,
      toggleLorebook: toggleNewRoleplayLorebook,
    },
    state: {
      characterIds: characterDraft.characterIds,
      companionMenuOpen: newRoleplayCompanionMenuOpen,
      connectionId: newRoleplayConnectionId,
      lorebookIds: selectedRoleplayLorebookIds,
      lorebookMenuOpen: newRoleplayLorebookMenuOpen,
      name: characterDraft.name,
      open: newRoleplayOpen,
      personaId: newRoleplayPersonaId,
    },
  };
}
