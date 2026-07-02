import type {
  LorebookActivationSettings,
  LorebookRecord,
  LoreEntryRecord,
} from "../contracts/types/lorebook";

// Pure lorebook activation helpers for generation prompt assembly. This module
// does not know about Messenger, Roleplay, React, storage, or runtime transport.

/** Transcript item used as lore activation scan input. */
export interface LorebookScanSource {
  name?: string | null;
  body: string | null | undefined;
}

/** Activated entry plus match provenance, ordering, and summary metadata. */
export interface ActivatedLoreEntry {
  lorebookId: string;
  lorebookTitle: string;
  lorebookSummary: string;
  entry: LoreEntryRecord;
  matchReason: "constant" | "primary-key";
  matchedKey: string | null;
  sourceOrder: number;
  entryIndex: number;
}

/** Options for trimming activated lore with absolute or context-percent caps. */
export interface ApplyTokenBudgetOptions {
  budgetTokens?: number | null;
  budgetPercent?: number | null;
  contextTokens?: number | null;
  approxTokens?: (entry: ActivatedLoreEntry) => number;
  reservedTokens?: number;
}

function isRegexLikeKey(key: string) {
  return /^\/.+\/[A-Za-z]*$/.test(key.trim());
}

function isWordCharacter(value: string | undefined) {
  return !!value && /[A-Za-z0-9_]/.test(value);
}

/**
 * Builds the transcript slice scanned by selective lore entries. A scan depth
 * of 0 scans nothing; otherwise only the most recent N sources are included.
 */
export function buildScanBuffer(
  sources: LorebookScanSource[],
  activation: Pick<LorebookActivationSettings, "scanDepth" | "includeNames">,
) {
  const scanDepth = Math.max(0, activation.scanDepth);
  const filledSources = sources.flatMap((source) => {
    const body = source.body?.trim() ?? "";
    if (!body) return [];
    return [
      {
        name: source.name?.trim() ?? "",
        body,
      },
    ];
  });
  const selectedSources =
    scanDepth === 0
      ? []
      : filledSources.slice(Math.max(0, filledSources.length - scanDepth));

  return selectedSources
    .map((source) => {
      const name = activation.includeNames ? source.name : "";
      return [name, source.body].filter(Boolean).join(": ");
    })
    .join("\n");
}

/**
 * Matches plaintext keys only. Regex-like slash keys are intentionally deferred
 * and return false until regex activation is implemented.
 */
export function matchKey(
  key: string,
  scanBuffer: string,
  activation: Pick<
    LorebookActivationSettings,
    "caseSensitiveKeys" | "matchWholeWords"
  >,
) {
  const trimmedKey = key.trim();
  if (!trimmedKey || isRegexLikeKey(trimmedKey)) return false;

  const haystack = activation.caseSensitiveKeys
    ? scanBuffer
    : scanBuffer.toLowerCase();
  const needle = activation.caseSensitiveKeys
    ? trimmedKey
    : trimmedKey.toLowerCase();

  if (!activation.matchWholeWords) return haystack.includes(needle);

  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : undefined;
    const after = haystack[index + needle.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }

  return false;
}

function entryHasBody(entry: LoreEntryRecord) {
  return entry.body.trim().length > 0;
}

function activateEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  sourceOrder: number,
  entryIndex: number,
  scanBuffer: string,
): ActivatedLoreEntry | null {
  if (!entry.enabled || !entryHasBody(entry)) return null;
  if (entry.strategy === "constant") {
    return {
      lorebookId: lorebook.id,
      lorebookTitle: lorebook.title,
      lorebookSummary: lorebook.summary,
      entry,
      matchReason: "constant",
      matchedKey: null,
      sourceOrder,
      entryIndex,
    };
  }

  const primaryKeys = entry.key?.map((key) => key.trim()).filter(Boolean) ?? [];
  if (primaryKeys.length === 0) return null;

  const matchedKey =
    primaryKeys.find((key) => matchKey(key, scanBuffer, lorebook.activation)) ??
    null;
  if (!matchedKey) return null;

  return {
    lorebookId: lorebook.id,
    lorebookTitle: lorebook.title,
    lorebookSummary: lorebook.summary,
    entry,
    matchReason: "primary-key",
    matchedKey,
    sourceOrder,
    entryIndex,
  };
}

function stableEntryTiebreaker(
  left: ActivatedLoreEntry,
  right: ActivatedLoreEntry,
) {
  if (left.sourceOrder !== right.sourceOrder) {
    return left.sourceOrder - right.sourceOrder;
  }
  return left.entryIndex - right.entryIndex;
}

/**
 * Sorts activated entries in prompt priority order. Higher insertion order wins;
 * equal order keeps lorebook/source order, then original entry order.
 */
export function sortActivatedEntries(entries: ActivatedLoreEntry[]) {
  return [...entries].sort((left, right) => {
    const orderDelta = right.entry.insertionOrder - left.entry.insertionOrder;
    return orderDelta || stableEntryTiebreaker(left, right);
  });
}

function budgetPriorityEntries(entries: ActivatedLoreEntry[]) {
  const constants = entries.filter((entry) => entry.entry.strategy === "constant");
  const selective = entries.filter((entry) => entry.entry.strategy !== "constant");
  return [...sortActivatedEntries(constants), ...sortActivatedEntries(selective)];
}

export function approximateLoreEntryTokens(entry: ActivatedLoreEntry) {
  const promptText =
    `${entry.lorebookTitle} / ${entry.entry.title}: ${entry.entry.body.trim()}`;
  return Math.ceil(promptText.length / 4);
}

function resolveTokenBudget({
  budgetPercent,
  budgetTokens,
  contextTokens,
}: ApplyTokenBudgetOptions) {
  if (
    typeof budgetTokens === "number" &&
    Number.isFinite(budgetTokens) &&
    budgetTokens >= 0
  ) {
    return Math.trunc(budgetTokens);
  }

  if (
    typeof budgetPercent === "number" &&
    Number.isFinite(budgetPercent) &&
    budgetPercent >= 0 &&
    typeof contextTokens === "number" &&
    Number.isFinite(contextTokens) &&
    contextTokens >= 0
  ) {
    return Math.trunc((contextTokens * Math.min(100, budgetPercent)) / 100);
  }

  return null;
}

/**
 * Applies a lore budget with a cheap token estimate. DeKoi currently has no
 * tokenizer dependency, so the default estimate is roughly chars / 4. Percent
 * budgets are only resolved when caller-provided context size is known.
 */
export function applyTokenBudget(
  entries: ActivatedLoreEntry[],
  options: ApplyTokenBudgetOptions,
) {
  const budget = resolveTokenBudget(options);
  if (budget === null) return sortActivatedEntries(entries);

  const approxTokens = options.approxTokens ?? approximateLoreEntryTokens;
  const kept: ActivatedLoreEntry[] = [];
  let usedTokens =
    typeof options.reservedTokens === "number" &&
    Number.isFinite(options.reservedTokens)
      ? Math.max(0, Math.ceil(options.reservedTokens))
      : 0;

  for (const entry of budgetPriorityEntries(entries)) {
    const entryTokens = Math.max(0, Math.ceil(approxTokens(entry)));
    if (usedTokens + entryTokens > budget) continue;
    kept.push(entry);
    usedTokens += entryTokens;
  }

  return sortActivatedEntries(kept);
}

/**
 * Returns enabled, non-empty lore entries that activate against the provided
 * scan text, including provenance for later prompt/debug surfaces.
 */
export function activateLorebookEntries(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: { sourceOrder?: number } = {},
) {
  const sourceOrder = options.sourceOrder ?? 0;
  return lorebook.entries.flatMap((entry, entryIndex) => {
    const activatedEntry = activateEntry(
      lorebook,
      entry,
      sourceOrder,
      entryIndex,
      scanBuffer,
    );
    return activatedEntry ? [activatedEntry] : [];
  });
}
