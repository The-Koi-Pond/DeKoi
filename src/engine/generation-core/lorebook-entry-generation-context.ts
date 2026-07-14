import type { LoreEntryRecord, LoreGenerationTriggerType } from "../contracts/types/lorebook";

export interface LoreEntryGenerationContext {
  generationTrigger: LoreGenerationTriggerType | null;
  targetCharacterId: string | null;
}

/** Returns whether an entry may participate in activation for this generation. */
export function loreEntryMatchesGenerationContext(
  entry: LoreEntryRecord,
  context: LoreEntryGenerationContext,
) {
  const triggerTypes = entry.triggers?.types ?? [];
  if (
    triggerTypes.length > 0 &&
    (!context.generationTrigger || !triggerTypes.includes(context.generationTrigger))
  ) {
    return false;
  }

  const characterIds = entry.characterFilter?.characterIds ?? [];
  if (characterIds.length === 0) return true;
  const targetIsListed = context.targetCharacterId
    ? characterIds.includes(context.targetCharacterId)
    : false;
  return entry.characterFilter?.mode === "include" ? targetIsListed : !targetIsListed;
}
