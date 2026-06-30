import { useEffect } from "react";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { NewThreadLabels } from "../lib/new-thread-labels";
import type { ShoalNav } from "../types";
import { useNewMessengerThreadPopover } from "./use-new-messenger-thread-popover";
import { useNewRoleplayThreadPopover } from "./use-new-roleplay-thread-popover";

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
  const messengerPopover = useNewMessengerThreadPopover({
    characters,
    defaultMessengerConnectionId,
    labels,
    onCreateMessengerThread,
  });
  const roleplayPopover = useNewRoleplayThreadPopover({
    characters,
    defaultMessengerConnectionId,
    labels,
    lorebooks,
    onCreateRoleplayThread,
    roleplayPersonaId,
  });
  const {
    closeNewMessengerThreadPopover,
    newMessengerOpen,
  } = messengerPopover;
  const {
    closeNewRoleplayThreadPopover,
    newRoleplayOpen,
  } = roleplayPopover;

  useEffect(() => {
    if (!newMessengerOpen && !newRoleplayOpen) return;

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeNewMessengerThreadPopover();
      closeNewRoleplayThreadPopover();
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [
    newRoleplayOpen,
    newMessengerOpen,
    closeNewMessengerThreadPopover,
    closeNewRoleplayThreadPopover,
  ]);

  function handleCreateActiveThread() {
    if (isRoleplaySurface) {
      if (newRoleplayOpen) {
        closeNewRoleplayThreadPopover();
        return;
      }

      closeNewMessengerThreadPopover();
      roleplayPopover.openNewRoleplayThreadPopover();
      return;
    }

    if (newMessengerOpen) {
      closeNewMessengerThreadPopover();
      return;
    }

    closeNewRoleplayThreadPopover();
    messengerPopover.openNewMessengerThreadPopover();
  }

  return {
    ...messengerPopover,
    ...roleplayPopover,
    handleCreateActiveThread,
  };
}

export type NewThreadPopovers = ReturnType<typeof useNewThreadPopovers>;
