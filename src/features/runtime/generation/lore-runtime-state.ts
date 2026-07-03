import type {
  LoreRuntimeState,
  LoreRuntimeStateOwnerKind,
} from "../../../engine/contracts/types/lore-runtime-state";
import {
  createLoreRuntimeState,
  hasActiveLoreRuntimeEntryTimers,
} from "../../../engine/lore-runtime/lore-runtime-actions";

export function createGenerationLoreRuntimeState({
  createId,
  existingState,
  now,
  ownerId,
  ownerKind,
}: {
  createId: (prefix: string) => string;
  existingState?: LoreRuntimeState | null;
  now: string;
  ownerId: string;
  ownerKind: LoreRuntimeStateOwnerKind;
}) {
  return (
    existingState ??
    createLoreRuntimeState({
      id: createId("lore-runtime-state"),
      now,
      ownerId,
      ownerKind,
    })
  );
}

export function compactGenerationLoreRuntimeState(
  runtimeState: LoreRuntimeState | null,
  updatedAt: string,
) {
  const entries = runtimeState?.entries.filter(hasActiveLoreRuntimeEntryTimers) ?? [];
  if (!runtimeState || entries.length === 0) return null;

  return {
    ...runtimeState,
    entries,
    updatedAt,
  };
}
