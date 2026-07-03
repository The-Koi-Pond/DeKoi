import { useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { useNewThreadCharacterDraft } from "./use-new-thread-character-draft";

interface UseNewMessengerThreadPopoverInput {
  characters: readonly CharacterRecord[];
  defaultMessengerConnectionId: string;
  labels: NewThreadLabels;
  onCreateMessengerThread: ShoalNav["createMessengerThread"];
}

export function useNewMessengerThreadPopover({
  characters,
  defaultMessengerConnectionId,
  labels,
  onCreateMessengerThread,
}: UseNewMessengerThreadPopoverInput) {
  const [newMessengerOpen, setNewMessengerOpen] = useState(false);
  const [newMessengerConnectionId, setNewMessengerConnectionId] = useState("");
  const [newMessengerPersonaId, setNewMessengerPersonaId] = useState("");
  const [newMessengerCompanionMenuOpen, setNewMessengerCompanionMenuOpen] = useState(false);
  const characterDraft = useNewThreadCharacterDraft({
    getDraftName: labels.getDraftCompanionName,
  });

  function resetNewMessengerThreadPopover() {
    characterDraft.resetCharacterDraft();
    setNewMessengerConnectionId("");
    setNewMessengerPersonaId("");
    setNewMessengerCompanionMenuOpen(false);
  }

  function closeNewMessengerThreadPopover() {
    resetNewMessengerThreadPopover();
    setNewMessengerOpen(false);
  }

  function openNewMessengerThreadPopover() {
    const initialCharacterIds = characters[0] ? [characters[0].id] : [];
    resetNewMessengerThreadPopover();
    characterDraft.initializeCharacterDraft(initialCharacterIds);
    setNewMessengerConnectionId(defaultMessengerConnectionId);
    setNewMessengerPersonaId("");
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(true);
  }

  function handleCreateMessengerThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (characterDraft.characterIds.length === 0) return;

    onCreateMessengerThread({
      activePersonaId: newMessengerPersonaId || null,
      characterIds: characterDraft.characterIds,
      providerConnectionId: newMessengerConnectionId || null,
      title: characterDraft.getTitle(),
    });
    closeNewMessengerThreadPopover();
  }

  return {
    actions: {
      close: closeNewMessengerThreadPopover,
      open: openNewMessengerThreadPopover,
      setCompanionMenuOpen: setNewMessengerCompanionMenuOpen,
      setConnectionId: setNewMessengerConnectionId,
      setName: characterDraft.updateName,
      setPersonaId: setNewMessengerPersonaId,
      submit: handleCreateMessengerThread,
      toggleCharacter: characterDraft.toggleCharacter,
    },
    state: {
      characterIds: characterDraft.characterIds,
      companionMenuOpen: newMessengerCompanionMenuOpen,
      connectionId: newMessengerConnectionId,
      name: characterDraft.name,
      open: newMessengerOpen,
      personaId: newMessengerPersonaId,
    },
  };
}
