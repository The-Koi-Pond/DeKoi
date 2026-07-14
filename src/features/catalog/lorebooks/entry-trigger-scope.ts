import type { LoreGenerationTriggerType } from "../../../engine/contracts/types/lorebook";
import type { LorebookEntryDraft } from "./lorebook-entry-draft";

const SUPPORTED_TRIGGER: LoreGenerationTriggerType = "normal";

export function updateTriggerScope(
  draft: LorebookEntryDraft,
  scope: "all" | "restricted",
): LorebookEntryDraft {
  const importedTypes = (draft.triggers?.types ?? []).filter((type) => type !== SUPPORTED_TRIGGER);
  if (scope === "all") {
    return importedTypes.length > 0 ? draft : { ...draft, triggers: null };
  }
  return { ...draft, triggers: { types: [...importedTypes, SUPPORTED_TRIGGER] } };
}
