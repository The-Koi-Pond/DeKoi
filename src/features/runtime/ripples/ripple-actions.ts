import type {
  Ripple,
  RippleState,
  RippleStateOwnerKind,
} from "../../../engine/contracts/types/ripples";
import {
  createRippleRecord,
  createRippleState,
  updateRippleRecord,
  type RippleInput,
} from "../../../engine/ripples/ripple-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";

export type { RippleInput, RippleState, RippleStateOwnerKind };

export function selectRippleState({
  rippleStates,
  ownerKind,
  ownerId,
}: {
  rippleStates: RippleState[];
  ownerKind: RippleStateOwnerKind;
  ownerId: string;
}) {
  return (
    rippleStates.find(
      (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
    ) ?? null
  );
}

export function createRuntimeRipple(input: RippleInput) {
  const now = currentIsoTimestamp();
  return createRippleRecord({
    id: createRecordId("ripple"),
    input,
    now,
  });
}

export function addRippleToOwnerState({
  rippleStates,
  ownerKind,
  ownerId,
  ripple,
}: {
  rippleStates: RippleState[];
  ownerKind: RippleStateOwnerKind;
  ownerId: string;
  ripple: Ripple;
}) {
  const existingState = selectRippleState({ rippleStates, ownerKind, ownerId });

  if (!existingState) {
    return [
      createRippleState({
        id: createRecordId("ripple-state"),
        now: ripple.updatedAt,
        ownerId,
        ownerKind,
        ripples: [ripple],
      }),
      ...rippleStates,
    ];
  }

  return rippleStates.map((state) =>
    state.id === existingState.id
      ? {
          ...state,
          ripples: [ripple, ...state.ripples],
          updatedAt: ripple.updatedAt,
        }
      : state,
  );
}

export function updateRippleInOwnerState({
  rippleStates,
  ownerKind,
  ownerId,
  rippleId,
  input,
}: {
  rippleStates: RippleState[];
  ownerKind: RippleStateOwnerKind;
  ownerId: string;
  rippleId: string;
  input: RippleInput;
}) {
  const now = currentIsoTimestamp();

  return rippleStates.map((state) =>
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
  );
}

export function deleteRippleFromOwnerState({
  rippleStates,
  ownerKind,
  ownerId,
  rippleId,
}: {
  rippleStates: RippleState[];
  ownerKind: RippleStateOwnerKind;
  ownerId: string;
  rippleId: string;
}) {
  const now = currentIsoTimestamp();

  return rippleStates.flatMap((state) => {
    if (state.ownerKind !== ownerKind || state.ownerId !== ownerId) {
      return [state];
    }

    const ripples = state.ripples.filter((ripple) => ripple.id !== rippleId);
    return ripples.length > 0 ? [{ ...state, ripples, updatedAt: now }] : [];
  });
}
