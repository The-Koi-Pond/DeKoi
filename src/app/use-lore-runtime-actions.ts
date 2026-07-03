import { useCallback } from "react";
import {
  deleteLoreRuntimeStateForOwner as removeLoreRuntimeStateForOwner,
  selectLoreRuntimeState,
  upsertLoreRuntimeState,
  type LoreRuntimeState,
  type LoreRuntimeStateOwnerKind,
} from "../features/runtime";
import type { StateSetter } from "../shared/react/state-setter";

type UseLoreRuntimeActionsInput = {
  loreRuntimeStates: LoreRuntimeState[];
  setLoreRuntimeStates: StateSetter<LoreRuntimeState[]>;
};

export function useLoreRuntimeActions({
  loreRuntimeStates,
  setLoreRuntimeStates,
}: UseLoreRuntimeActionsInput) {
  const getLoreRuntimeState = useCallback(
    (ownerKind: LoreRuntimeStateOwnerKind, ownerId: string) =>
      selectLoreRuntimeState({ loreRuntimeStates, ownerKind, ownerId }),
    [loreRuntimeStates],
  );

  const updateLoreRuntimeState = useCallback(
    (
      runtimeState: LoreRuntimeState | null,
      ownerKind: LoreRuntimeStateOwnerKind,
      ownerId: string,
    ) => {
      setLoreRuntimeStates((currentStates) =>
        runtimeState
          ? upsertLoreRuntimeState(currentStates, runtimeState)
          : removeLoreRuntimeStateForOwner(currentStates, ownerKind, ownerId),
      );
    },
    [setLoreRuntimeStates],
  );

  return {
    getLoreRuntimeState,
    updateLoreRuntimeState,
  };
}
