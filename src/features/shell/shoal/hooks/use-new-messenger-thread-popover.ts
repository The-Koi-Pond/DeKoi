import { useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import { toggleSelectedId } from "../lib/toggle-selected-id";
import type { ShoalNav } from "../types";

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
  const [newMessengerName, setNewMessengerName] = useState("");
  const [newMessengerNameEdited, setNewMessengerNameEdited] = useState(false);
  const [newMessengerConnectionId, setNewMessengerConnectionId] = useState("");
  const [newMessengerPersonaId, setNewMessengerPersonaId] = useState("");
  const [newMessengerCharacterIds, setNewMessengerCharacterIds] = useState<
    string[]
  >([]);
  const [newMessengerCompanionMenuOpen, setNewMessengerCompanionMenuOpen] =
    useState(false);

  function resetNewMessengerThreadPopover() {
    setNewMessengerCharacterIds([]);
    setNewMessengerName("");
    setNewMessengerNameEdited(false);
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
    setNewMessengerCharacterIds(initialCharacterIds);
    setNewMessengerName(labels.getDraftCompanionName(initialCharacterIds));
    setNewMessengerNameEdited(false);
    setNewMessengerConnectionId(defaultMessengerConnectionId);
    setNewMessengerPersonaId("");
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(true);
  }

  function updateNewMessengerCharacterIds(characterIds: string[]) {
    setNewMessengerCharacterIds(characterIds);
    if (!newMessengerNameEdited) {
      setNewMessengerName(labels.getDraftCompanionName(characterIds));
    }
  }

  function toggleNewMessengerCharacter(characterId: string) {
    updateNewMessengerCharacterIds(
      toggleSelectedId(newMessengerCharacterIds, characterId),
    );
  }

  function handleNewMessengerNameChange(name: string) {
    setNewMessengerName(name);
    setNewMessengerNameEdited(true);
  }

  function handleCreateMessengerThread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newMessengerCharacterIds.length === 0) return;

    const title =
      newMessengerName.trim() ||
      labels.getDraftCompanionName(newMessengerCharacterIds);
    onCreateMessengerThread({
      activePersonaId: newMessengerPersonaId || null,
      characterIds: newMessengerCharacterIds,
      providerConnectionId: newMessengerConnectionId || null,
      title,
    });
    closeNewMessengerThreadPopover();
  }

  return {
    actions: {
      close: closeNewMessengerThreadPopover,
      open: openNewMessengerThreadPopover,
      setCompanionMenuOpen: setNewMessengerCompanionMenuOpen,
      setConnectionId: setNewMessengerConnectionId,
      setName: handleNewMessengerNameChange,
      setPersonaId: setNewMessengerPersonaId,
      submit: handleCreateMessengerThread,
      toggleCharacter: toggleNewMessengerCharacter,
    },
    state: {
      characterIds: newMessengerCharacterIds,
      companionMenuOpen: newMessengerCompanionMenuOpen,
      connectionId: newMessengerConnectionId,
      name: newMessengerName,
      open: newMessengerOpen,
      personaId: newMessengerPersonaId,
    },
  };
}
