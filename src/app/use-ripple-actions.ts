import { useCallback } from "react";
import {
  addRippleToOwnerState,
  createRuntimeRipple,
  deleteRippleFromOwnerState,
  selectRippleState,
  updateRippleInOwnerState,
  type RippleInput,
  type RippleState,
  type RippleStateOwnerKind,
} from "../features/runtime";
import type { StateSetter } from "../shared/react/state-setter";

type UseRippleActionsInput = {
  rippleStates: RippleState[];
  setRippleStates: StateSetter<RippleState[]>;
};

export function useRippleActions({ rippleStates, setRippleStates }: UseRippleActionsInput) {
  const getRippleState = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string) =>
      selectRippleState({ rippleStates, ownerKind, ownerId }),
    [rippleStates],
  );

  const createRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, input: RippleInput) => {
      const ripple = createRuntimeRipple(input);
      setRippleStates((currentStates) =>
        addRippleToOwnerState({
          rippleStates: currentStates,
          ownerKind,
          ownerId,
          ripple,
        }),
      );
      return ripple;
    },
    [setRippleStates],
  );

  const updateRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, rippleId: string, input: RippleInput) => {
      setRippleStates((currentStates) =>
        updateRippleInOwnerState({
          rippleStates: currentStates,
          ownerKind,
          ownerId,
          rippleId,
          input,
        }),
      );
    },
    [setRippleStates],
  );

  const deleteRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, rippleId: string) => {
      setRippleStates((currentStates) =>
        deleteRippleFromOwnerState({
          rippleStates: currentStates,
          ownerKind,
          ownerId,
          rippleId,
        }),
      );
    },
    [setRippleStates],
  );

  return {
    getRippleState,
    createRipple,
    updateRipple,
    deleteRipple,
  };
}
