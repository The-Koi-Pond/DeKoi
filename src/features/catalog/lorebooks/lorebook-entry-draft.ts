import type {
  LorebookEntryInput,
} from "../../../engine/catalog/lorebook-actions";
import type {
  LoreEntryRole,
  LoreEntryStrategy,
  LoreInsertionPosition,
} from "../../../engine/contracts/types/lorebook";

export interface LorebookEntryDraft {
  title: string;
  body: string;
  enabled: boolean;
  strategy: LoreEntryStrategy;
  key: string;
  insertionOrder: string;
  insertionPosition: LoreInsertionPosition;
  depth: string;
  role: LoreEntryRole;
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

export function readFiniteNumberInput(value: string, fallback: number) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return fallback;
  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function readNonNegativeIntegerInput(value: string, fallback: number) {
  const numericValue = readFiniteNumberInput(value, fallback);
  return Math.max(0, Math.trunc(numericValue));
}

export function readNullableNonNegativeIntegerInput(
  value: string,
  fallback: number | null,
) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.trunc(numericValue));
}

export function readNullablePercentInput(
  value: string,
  fallback: number | null,
) {
  const percent = readNullableNonNegativeIntegerInput(value, fallback);
  return typeof percent === "number" ? Math.min(100, percent) : percent;
}

export function entryDraftDisablesBannerSave({
  draft,
  showEditor,
  showLorebookEditor,
}: {
  draft: LorebookEntryDraft;
  showEditor: boolean;
  showLorebookEditor: boolean;
}) {
  return (
    showEditor &&
    !showLorebookEditor &&
    !canSaveLorebookEntryDraft(draft)
  );
}

export function lorebookEntryDraftToInput(
  draft: LorebookEntryDraft,
): LorebookEntryInput {
  const depth =
    draft.insertionPosition === "at-depth"
      ? readNonNegativeIntegerInput(draft.depth, 0)
      : null;
  return {
    title: draft.title.trim() || "Untitled note",
    body: draft.body.trim(),
    enabled: draft.enabled,
    strategy: draft.strategy,
    key: parseLorebookEntryKeys(draft.key),
    insertionOrder: readFiniteNumberInput(draft.insertionOrder, 100),
    insertionPosition: draft.insertionPosition,
    depth,
    role: draft.insertionPosition === "at-depth" ? draft.role : null,
  };
}
