import type { LorebookEntryInput } from "../../../engine/catalog/lorebook-actions";
import {
  DEFAULT_LORE_ENTRY_TIMING,
  DEFAULT_LORE_ENTRY_RECURSION,
  resolveEntryRecursion,
  resolveEntryTiming,
  type LoreEntryRecord,
  type LoreEntryTiming,
  type LoreEntryRecursion,
  type LoreEntryRole,
  type LoreEntryStrategy,
  type LoreEntryTriggers,
  type LoreCharacterFilter,
  type LoreInsertionPosition,
  type LoreMatchSources,
  type LoreSelectiveLogic,
} from "../../../engine/contracts/types/lorebook";

const supportedRegexFlags = new Set(["d", "g", "i", "m", "s", "u", "v", "y"]);

export interface LorebookEntryDraft {
  title: string;
  body: string;
  enabled: boolean;
  strategy: LoreEntryStrategy;
  key: string;
  keySecondary: string;
  selectiveLogic: LoreSelectiveLogic;
  probability: string;
  inclusionGroup: string;
  groupWeight: string;
  prioritizeInclusion: boolean;
  insertionOrder: string;
  insertionPosition: LoreInsertionPosition;
  depth: string;
  role: LoreEntryRole;
  nonRecursable: boolean;
  preventFurther: boolean;
  delayUntilRecursion: boolean;
  recursionLevel: string;
  sticky: string;
  cooldown: string;
  delay: string;
  matchSources: LoreMatchSources;
  triggers: LoreEntryTriggers | null;
  characterFilter: LoreCharacterFilter | null;
}

export const EMPTY_LORE_MATCH_SOURCES: LoreMatchSources = {
  characterDescription: false,
  characterPersonality: false,
  scenario: false,
  characterNote: false,
  personaDescription: false,
};

function splitLorebookEntryKeys(value: string) {
  const keys: string[] = [];
  let currentKey = "";
  let regexState: "body" | "flags" | null = null;
  let escaped = false;
  let regexFlagsAreWellFormed = true;
  let regexFlags = "";

  function pushCurrentKey() {
    const key = currentKey.trim();
    if (key) keys.push(key);
    currentKey = "";
    regexState = null;
    escaped = false;
    regexFlagsAreWellFormed = true;
    regexFlags = "";
  }

  function splitMalformedRegexCandidate() {
    for (const key of currentKey.split(",")) {
      const trimmedKey = key.trim();
      if (trimmedKey) keys.push(trimmedKey);
    }
    currentKey = "";
    regexState = null;
    escaped = false;
    regexFlagsAreWellFormed = true;
    regexFlags = "";
  }

  for (const char of value) {
    if (regexState === null) {
      if (char === ",") {
        pushCurrentKey();
        continue;
      }
      if (char === "/" && currentKey.trim().length === 0) {
        regexState = "body";
        regexFlags = "";
      }
      currentKey += char;
      continue;
    }

    currentKey += char;

    if (regexState === "body") {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "/") {
        regexState = "flags";
      }
      continue;
    }

    if (char === ",") {
      currentKey = currentKey.slice(0, -1);
      if (!regexFlagsAreWellFormed) {
        splitMalformedRegexCandidate();
        continue;
      }
      pushCurrentKey();
      continue;
    }

    if (/\s/.test(char)) {
      continue;
    }

    if (
      !supportedRegexFlags.has(char) ||
      regexFlags.includes(char) ||
      (char === "u" && regexFlags.includes("v")) ||
      (char === "v" && regexFlags.includes("u"))
    ) {
      regexFlagsAreWellFormed = false;
    } else {
      regexFlags += char;
    }
  }

  if (regexState === "body" || !regexFlagsAreWellFormed) {
    splitMalformedRegexCandidate();
    return keys;
  }

  pushCurrentKey();
  return keys;
}

export function parseLorebookEntryKeys(value: string) {
  const keys = splitLorebookEntryKeys(value);
  return keys.length > 0 ? keys : null;
}

export function canSaveLorebookEntryDraft(draft: LorebookEntryDraft) {
  const hasRequiredSelectiveKey =
    draft.strategy !== "selective" || parseLorebookEntryKeys(draft.key) !== null;
  const hasTriggerSelection = !draft.triggers || (draft.triggers.types?.length ?? 0) > 0;
  const hasCharacterSelection =
    !draft.characterFilter || draft.characterFilter.characterIds.some((id) => id.trim());
  return hasRequiredSelectiveKey && hasTriggerSelection && hasCharacterSelection;
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

export function readNonNegativeFiniteNumberInput(value: string, fallback: number) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return fallback;
  const numericValue = Number(trimmedValue);
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : fallback;
}

export function readNullableNonNegativeIntegerInput(value: string, fallback: number | null) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  const numericValue = Number(trimmedValue);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.trunc(numericValue));
}

export function readNullablePercentInput(value: string, fallback: number | null) {
  const percent = readNullableNonNegativeIntegerInput(value, fallback);
  return typeof percent === "number" ? Math.min(100, percent) : percent;
}

export function readPercentInput(value: string, fallback: number) {
  return Math.min(100, readNonNegativeIntegerInput(value, fallback));
}

export function normalizeLoreMatchSources(
  value: LoreMatchSources | null | undefined,
): LoreMatchSources {
  return {
    ...EMPTY_LORE_MATCH_SOURCES,
    ...(value ?? {}),
  };
}

function compactLoreMatchSources(value: LoreMatchSources) {
  return Object.values(value).some(Boolean) ? value : null;
}

function cleanUniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function compactLoreEntryTriggers(triggers: LoreEntryTriggers | null) {
  if (!triggers) return null;
  const types = [...new Set(triggers.types ?? [])];
  return types.length > 0 ? { types } : null;
}

function compactLoreCharacterFilter(characterFilter: LoreCharacterFilter | null) {
  if (!characterFilter) return null;
  const characterIds = cleanUniqueIds(characterFilter.characterIds);
  return characterIds.length > 0 ? { ...characterFilter, characterIds } : null;
}

function compactLoreEntryRecursion(draft: LorebookEntryDraft): LoreEntryRecursion | null {
  const recursion: LoreEntryRecursion = {
    nonRecursable: draft.nonRecursable,
    preventFurther: draft.preventFurther,
    delayUntilRecursion: draft.delayUntilRecursion,
    recursionLevel: draft.delayUntilRecursion
      ? readNonNegativeIntegerInput(
          draft.recursionLevel,
          DEFAULT_LORE_ENTRY_RECURSION.recursionLevel,
        )
      : DEFAULT_LORE_ENTRY_RECURSION.recursionLevel,
  };
  return recursion.nonRecursable || recursion.preventFurther || recursion.delayUntilRecursion
    ? recursion
    : null;
}

function compactLoreEntryTiming(draft: LorebookEntryDraft): LoreEntryTiming | null {
  const timing: LoreEntryTiming = {
    sticky: readNonNegativeIntegerInput(draft.sticky, DEFAULT_LORE_ENTRY_TIMING.sticky),
    cooldown: readNonNegativeIntegerInput(draft.cooldown, DEFAULT_LORE_ENTRY_TIMING.cooldown),
    delay: readNonNegativeIntegerInput(draft.delay, DEFAULT_LORE_ENTRY_TIMING.delay),
  };

  return timing.sticky > 0 || timing.cooldown > 0 || timing.delay > 0 ? timing : null;
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
  return showEditor && !showLorebookEditor && !canSaveLorebookEntryDraft(draft);
}

export function lorebookEntryDraftFromRecord(entry: LoreEntryRecord): LorebookEntryDraft {
  const recursion = resolveEntryRecursion(entry);
  const timing = resolveEntryTiming(entry);
  return {
    title: entry.title,
    body: entry.body,
    enabled: entry.enabled,
    strategy: entry.strategy,
    key: entry.key?.join(", ") ?? "",
    keySecondary: entry.keySecondary?.join(", ") ?? "",
    selectiveLogic: entry.selectiveLogic ?? "and-any",
    probability: String(entry.probability),
    inclusionGroup: entry.inclusionGroup ?? "",
    groupWeight: String(entry.groupWeight),
    prioritizeInclusion: entry.prioritizeInclusion,
    insertionOrder: String(entry.insertionOrder),
    insertionPosition: entry.insertionPosition,
    depth: String(entry.depth ?? 0),
    role: entry.role ?? "system",
    nonRecursable: recursion.nonRecursable,
    preventFurther: recursion.preventFurther,
    delayUntilRecursion: recursion.delayUntilRecursion,
    recursionLevel: String(recursion.recursionLevel),
    sticky: String(timing.sticky),
    cooldown: String(timing.cooldown),
    delay: String(timing.delay),
    matchSources: normalizeLoreMatchSources(entry.matchSources),
    triggers:
      entry.triggers?.types && entry.triggers.types.length > 0
        ? { types: [...entry.triggers.types] }
        : null,
    characterFilter:
      entry.characterFilter && entry.characterFilter.characterIds.length > 0
        ? { ...entry.characterFilter, characterIds: [...entry.characterFilter.characterIds] }
        : null,
  };
}

export function lorebookEntryDraftToInput(draft: LorebookEntryDraft): LorebookEntryInput {
  const keySecondary = parseLorebookEntryKeys(draft.keySecondary);
  const depth =
    draft.insertionPosition === "at-depth" ? readNonNegativeIntegerInput(draft.depth, 0) : null;
  return {
    title: draft.title.trim() || "Untitled note",
    body: draft.body.trim(),
    enabled: draft.enabled,
    strategy: draft.strategy,
    key: parseLorebookEntryKeys(draft.key),
    keySecondary,
    selectiveLogic: keySecondary ? draft.selectiveLogic : null,
    probability: readPercentInput(draft.probability, 100),
    inclusionGroup: draft.inclusionGroup,
    groupWeight: readNonNegativeFiniteNumberInput(draft.groupWeight, 100),
    prioritizeInclusion: draft.prioritizeInclusion,
    insertionOrder: readFiniteNumberInput(draft.insertionOrder, 100),
    insertionPosition: draft.insertionPosition,
    depth,
    role: draft.insertionPosition === "at-depth" ? draft.role : null,
    recursion: compactLoreEntryRecursion(draft),
    timing: compactLoreEntryTiming(draft),
    matchSources: compactLoreMatchSources(draft.matchSources),
    triggers: compactLoreEntryTriggers(draft.triggers),
    characterFilter: compactLoreCharacterFilter(draft.characterFilter),
  };
}
