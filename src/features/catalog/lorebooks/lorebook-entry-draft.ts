import type { LorebookEntryInput } from "../../../engine/catalog/lorebook-actions";
import type {
  LoreEntryRole,
  LoreEntryStrategy,
  LoreInsertionPosition,
  LoreMatchSources,
  LoreSelectiveLogic,
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
  insertionOrder: string;
  insertionPosition: LoreInsertionPosition;
  depth: string;
  role: LoreEntryRole;
  matchSources: LoreMatchSources;
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
  return draft.strategy !== "selective" || parseLorebookEntryKeys(draft.key) !== null;
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
    insertionOrder: readFiniteNumberInput(draft.insertionOrder, 100),
    insertionPosition: draft.insertionPosition,
    depth,
    role: draft.insertionPosition === "at-depth" ? draft.role : null,
    matchSources: compactLoreMatchSources(draft.matchSources),
  };
}
