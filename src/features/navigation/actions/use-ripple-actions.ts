import { useCallback } from "react";
import type { RippleState, RippleStateOwnerKind } from "../../../engine/ripples";
import {
  createRippleRecord,
  createRippleState,
  updateRippleRecord,
  type RippleInput,
} from "../../../engine/ripple-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseRippleActionsInput = {
  rippleStates: RippleState[];
  setRippleStates: StateSetter<RippleState[]>;
};

export function useRippleActions({
  rippleStates,
  setRippleStates,
}: UseRippleActionsInput) {
  const getRippleState = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string) =>
      rippleStates.find(
        (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
      ) ?? null,
    [rippleStates],
  );

  const createRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, input: RippleInput) => {
      const now = currentIsoTimestamp();
      const ripple = createRippleRecord({
        id: createRecordId("ripple"),
        input,
        now,
      });

      setRippleStates((currentStates) => {
        const existingState = currentStates.find(
          (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
        );

        if (!existingState) {
          return [
            createRippleState({
              id: createRecordId("ripple-state"),
              now,
              ownerId,
              ownerKind,
              ripples: [ripple],
            }),
            ...currentStates,
          ];
        }

        return currentStates.map((state) =>
          state.id === existingState.id
            ? {
                ...state,
                ripples: [ripple, ...state.ripples],
                updatedAt: now,
              }
            : state,
        );
      });

      return ripple;
    },
    [setRippleStates],
  );

  const updateRipple = useCallback(
    (
      ownerKind: RippleStateOwnerKind,
      ownerId: string,
      rippleId: string,
      input: RippleInput,
    ) => {
      const now = currentIsoTimestamp();
      setRippleStates((currentStates) =>
        currentStates.map((state) =>
          state.ownerKind === ownerKind && state.ownerId === ownerId
            ? {
                ...state,
                ripples: state.ripples.map((ripple) =>
                  ripple.id === rippleId
                    ? updateRippleRecord(ripple, input, now)
                    : ripple,
                ),
                updatedAt: now,
              }
            : state,
        ),
      );
    },
    [setRippleStates],
  );

  const deleteRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, rippleId: string) => {
      const now = currentIsoTimestamp();
      setRippleStates((currentStates) =>
        currentStates.flatMap((state) => {
          if (state.ownerKind !== ownerKind || state.ownerId !== ownerId) {
            return [state];
          }

          const ripples = state.ripples.filter(
            (ripple) => ripple.id !== rippleId,
          );
          return ripples.length > 0
            ? [{ ...state, ripples, updatedAt: now }]
            : [];
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
