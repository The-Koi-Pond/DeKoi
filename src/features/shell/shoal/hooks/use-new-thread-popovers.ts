import { useEffect, useState, type FormEvent } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";

interface UseNewThreadPopoversInput {
  characters: readonly CharacterRecord[];
  defaultMessengerConnectionId: string;
  isRoleplaySurface: boolean;
  labels: NewThreadLabels;
  lorebooks: readonly LorebookRecord[];
  onCreateMessengerThread: ShoalNav["createMessengerThread"];
  onCreateRoleplayThread: ShoalNav["createRoleplayThread"];
  roleplayPersonaId: string;
}

export function useNewThreadPopovers({
  characters,
  defaultMessengerConnectionId,
  isRoleplaySurface,
  labels,
  lorebooks,
  onCreateMessengerThread,
  onCreateRoleplayThread,
  roleplayPersonaId,
}: UseNewThreadPopoversInput) {
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

  useEffect(() => {
    if (!newMessengerOpen && !newRoleplayOpen) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setNewMessengerOpen(false);
      setNewRoleplayOpen(false);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [newRoleplayOpen, newMessengerOpen]);

  function openNewMessengerThreadPopover() {
    const initialCharacterIds = characters[0] ? [characters[0].id] : [];
    setNewRoleplayOpen(false);
    setNewMessengerCharacterIds(initialCharacterIds);
    setNewMessengerName(labels.getDraftCompanionName(initialCharacterIds));
    setNewMessengerNameEdited(false);
    setNewMessengerConnectionId(defaultMessengerConnectionId);
    setNewMessengerPersonaId("");
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(true);
  }

  function openNewRoleplayThreadPopover() {
    const initialCharacterIds = characters[0] ? [characters[0].id] : [];
    setNewMessengerOpen(false);
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

  function updateNewMessengerCharacterIds(characterIds: string[]) {
    setNewMessengerCharacterIds(characterIds);
    if (!newMessengerNameEdited) {
      setNewMessengerName(labels.getDraftCompanionName(characterIds));
    }
  }

  function toggleNewMessengerCharacter(characterId: string) {
    const nextIds = newMessengerCharacterIds.includes(characterId)
      ? newMessengerCharacterIds.filter((id) => id !== characterId)
      : [...newMessengerCharacterIds, characterId];
    updateNewMessengerCharacterIds(nextIds);
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
    setNewMessengerCompanionMenuOpen(false);
    setNewMessengerOpen(false);
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

  function handleCreateActiveThread() {
    if (isRoleplaySurface) {
      if (newRoleplayOpen) {
        setNewRoleplayOpen(false);
        return;
      }

      openNewRoleplayThreadPopover();
      return;
    }

    if (newMessengerOpen) {
      setNewMessengerOpen(false);
      return;
    }

    openNewMessengerThreadPopover();
  }

  return {
    handleCreateActiveThread,
    handleCreateMessengerThread,
    handleCreateRoleplayThread,
    newMessengerCharacterIds,
    newMessengerCompanionMenuOpen,
    newMessengerConnectionId,
    newMessengerName,
    newMessengerOpen,
    newMessengerPersonaId,
    newRoleplayCharacterIds,
    newRoleplayCompanionMenuOpen,
    newRoleplayConnectionId,
    newRoleplayLorebookIds,
    newRoleplayLorebookMenuOpen,
    newRoleplayName,
    newRoleplayOpen,
    newRoleplayPersonaId,
    setNewMessengerCompanionMenuOpen,
    setNewMessengerConnectionId,
    setNewMessengerName,
    setNewMessengerNameEdited,
    setNewMessengerOpen,
    setNewMessengerPersonaId,
    setNewRoleplayCompanionMenuOpen,
    setNewRoleplayConnectionId,
    setNewRoleplayLorebookMenuOpen,
    setNewRoleplayName,
    setNewRoleplayNameEdited,
    setNewRoleplayOpen,
    setNewRoleplayPersonaId,
    toggleNewMessengerCharacter,
    toggleNewRoleplayCharacter,
    toggleNewRoleplayLorebook,
  };
}

export type NewThreadPopovers = ReturnType<typeof useNewThreadPopovers>;
