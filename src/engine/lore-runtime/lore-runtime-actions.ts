import type {
  LoreRuntimeEntryState,
  LoreRuntimeState,
  LoreRuntimeStateOwnerKind,
} from "../contracts/types/lore-runtime-state";

export function createLoreRuntimeState({
  id,
  now,
  ownerId,
  ownerKind,
}: {
  id: string;
  now: string;
  ownerId: string;
  ownerKind: LoreRuntimeStateOwnerKind;
}): LoreRuntimeState {
  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    lastEvaluatedMessageCount: 0,
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function selectLoreRuntimeState({
  loreRuntimeStates,
  ownerId,
  ownerKind,
}: {
  loreRuntimeStates: LoreRuntimeState[];
  ownerId: string;
  ownerKind: LoreRuntimeStateOwnerKind;
}) {
  return (
    loreRuntimeStates.find((state) => state.ownerKind === ownerKind && state.ownerId === ownerId) ??
    null
  );
}

export function hasActiveLoreRuntimeEntryTimers(
  entryState: Pick<LoreRuntimeEntryState, "stickyRemaining" | "cooldownRemaining">,
) {
  return entryState.stickyRemaining > 0 || entryState.cooldownRemaining > 0;
}

export function upsertLoreRuntimeState(
  loreRuntimeStates: LoreRuntimeState[],
  runtimeState: LoreRuntimeState,
) {
  const nextState = {
    ...runtimeState,
    entries: runtimeState.entries.filter(hasActiveLoreRuntimeEntryTimers),
  };

  if (nextState.entries.length === 0) {
    return deleteLoreRuntimeStateForOwner(
      loreRuntimeStates,
      nextState.ownerKind,
      nextState.ownerId,
    );
  }

  const withoutSameOwner = loreRuntimeStates.filter(
    (state) => state.ownerKind !== nextState.ownerKind || state.ownerId !== nextState.ownerId,
  );
  return [nextState, ...withoutSameOwner];
}

export function deleteLoreRuntimeStateForOwner(
  loreRuntimeStates: LoreRuntimeState[],
  ownerKind: LoreRuntimeStateOwnerKind,
  ownerId: string,
) {
  return loreRuntimeStates.filter(
    (state) => state.ownerKind !== ownerKind || state.ownerId !== ownerId,
  );
}
