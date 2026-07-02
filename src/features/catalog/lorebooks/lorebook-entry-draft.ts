import type {
  LorebookEntryInput,
} from "../../../engine/catalog/lorebook-actions";
import type { LoreEntryStrategy } from "../../../engine/contracts/types/lorebook";

export interface LorebookEntryDraft {
  title: string;
  body: string;
  enabled: boolean;
  strategy: LoreEntryStrategy;
  key: string;
}

export function parseLorebookEntryKeys(value: string) {
  const keys = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return keys.length > 0 ? keys : null;
}

export function canSaveLorebookEntryDraft(draft: LorebookEntryDraft) {
  return (
    draft.strategy !== "selective" || parseLorebookEntryKeys(draft.key) !== null
  );
}

export function lorebookEntryDraftToInput(
  draft: LorebookEntryDraft,
): LorebookEntryInput {
  return {
    title: draft.title.trim() || "Untitled note",
    body: draft.body.trim(),
    enabled: draft.enabled,
    strategy: draft.strategy,
    key: parseLorebookEntryKeys(draft.key),
  };
}
