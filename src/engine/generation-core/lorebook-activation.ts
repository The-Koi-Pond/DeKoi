import {
  resolveEntryRecursion,
  type LorebookActivationSettings,
  type LorebookRecord,
  type LoreEntryRecord,
  type LoreMatchSources,
} from "../contracts/types/lorebook";
import type { CharacterRecord } from "../contracts/types/character";
import type { PersonaRecord } from "../contracts/types/persona";
import {
  compareActivatedEntryOrder,
  finalizeActivationResult,
} from "./lorebook-activation-resolution";
import type {
  ActivatedLoreEntry,
  LorebookActivationResult,
  PrimaryMatchCountResult,
} from "./lorebook-activation-types";

export type { ActivatedLoreEntry, LorebookActivationResult } from "./lorebook-activation-types";

// Pure lorebook activation helpers for generation prompt assembly. This module
// does not know about Messenger, Roleplay, React, storage, or runtime transport.

/** Transcript item used as lore activation scan input. */
export interface LorebookScanSource {
  name?: string | null;
  body: string | null | undefined;
}

/** Catalog records used to build optional companion/persona match sources. */
export interface LorebookMatchSourceContext {
  companions?: CharacterRecord[];
  activePersona?: PersonaRecord | null;
}

type LoreMatchSourceKey = keyof LoreMatchSources;

type LoreMatchSourceBuckets = Record<LoreMatchSourceKey, LorebookScanSource[]>;

/** Options for trimming activated lore with absolute or context-percent caps. */
export interface ApplyTokenBudgetOptions {
  budgetTokens?: number | null;
  budgetPercent?: number | null;
  contextTokens?: number | null;
  approxTokens?: (entry: ActivatedLoreEntry) => number;
  reservedTokens?: number;
}

/** Options for lore activation and deterministic test-time random gates. */
export interface LorebookActivationOptions {
  /** Selected-lorebook order used as a stable tiebreaker across multiple lorebooks. */
  sourceOrder?: number;
  /** Prebuilt companion/persona source buckets for entries that opt into extra matching. */
  matchSources?: LoreMatchSourceBuckets;
  /** Random source used by weighted inclusion groups and probability gates. */
  rand?: () => number;
}

interface CompiledRegexKey {
  regex: RegExp | null;
  warning: string | null;
}

interface KeyMatchContext {
  regexCache: Map<string, CompiledRegexKey>;
}

interface KeyMatchResult {
  matched: boolean;
  dedupeKey: string;
  warnings: string[];
}

interface EntryActivationResult {
  entry: ActivatedLoreEntry | null;
  primaryMatchCounter?: () => PrimaryMatchCountResult;
  warnings: string[];
}

type ActivationSource = ActivatedLoreEntry["activationSource"];
type EntryActivationMode = "activate" | "probe";
type PrimaryMatchCounter = () => PrimaryMatchCountResult;

interface ActivateEntryOptions {
  mode?: EntryActivationMode;
}

interface RegexGroupSafety {
  hasInnerVariableQuantifier: boolean;
  hasAlternation: boolean;
}

type RegexSafetyAtom =
  { kind: "group"; group: RegexGroupSafety } | { kind: "atom" } | { kind: "none" };

function createKeyMatchContext(): KeyMatchContext {
  return { regexCache: new Map() };
}

function emptyMatchSources(): LoreMatchSourceBuckets {
  return {
    characterDescription: [],
    characterPersonality: [],
    scenario: [],
    characterNote: [],
    personaDescription: [],
  };
}

const EMPTY_MATCH_SOURCES = emptyMatchSources();
const LOREBOOK_RECURSION_HARD_PASS_CAP = 64;

const COMPANION_MATCH_SOURCE_FIELDS = {
  characterDescription: "description",
  characterPersonality: "personality",
  scenario: "scenario",
  characterNote: "characterNote",
} as const satisfies Record<
  Exclude<LoreMatchSourceKey, "personaDescription">,
  keyof CharacterRecord
>;

function parseRegexKey(key: string) {
  const match = key.trim().match(/^\/(.+)\/([A-Za-z]*)$/);
  if (!match) return null;
  const pattern = match[1];
  const flags = match[2] ?? "";
  if (pattern === undefined) return null;
  return {
    pattern,
    flags,
  };
}

function regexQuantifierAt(pattern: string, index: number) {
  const char = pattern[index];
  if (char === "*" || char === "+") {
    return { endIndex: index, canRepeat: true, canVary: true };
  }
  if (char === "?") {
    return { endIndex: index, canRepeat: false, canVary: true };
  }
  if (char !== "{") return null;

  const closeIndex = pattern.indexOf("}", index + 1);
  if (closeIndex === -1) return null;
  const quantifier = pattern.slice(index + 1, closeIndex);
  const match = quantifier.match(/^(\d+)(?:,(\d*))?$/);
  if (!match) return null;

  const minimum = Number(match[1]);
  const maximum = match[2] === undefined ? minimum : match[2] === "" ? Infinity : Number(match[2]);

  return {
    endIndex: closeIndex,
    canRepeat: maximum > 1,
    canVary: minimum !== maximum,
  };
}

function unsafeRegexPatternReason(pattern: string) {
  const groups: RegexGroupSafety[] = [];
  let atom: RegexSafetyAtom = { kind: "none" };
  let escaped = false;
  let inCharacterClass = false;

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (escaped) {
      escaped = false;
      if (!inCharacterClass) atom = { kind: "atom" };
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (inCharacterClass) {
      if (char === "]") {
        inCharacterClass = false;
        atom = { kind: "atom" };
      }
      continue;
    }

    if (char === "[") {
      inCharacterClass = true;
      atom = { kind: "none" };
      continue;
    }

    if (char === "(") {
      groups.push({ hasInnerVariableQuantifier: false, hasAlternation: false });
      atom = { kind: "none" };
      continue;
    }

    if (char === ")") {
      const group = groups.pop();
      if (!group) {
        atom = { kind: "atom" };
        continue;
      }
      const parentGroup = groups[groups.length - 1];
      if (parentGroup) {
        parentGroup.hasInnerVariableQuantifier ||= group.hasInnerVariableQuantifier;
        parentGroup.hasAlternation ||= group.hasAlternation;
      }
      atom = { kind: "group", group };
      continue;
    }

    if (char === "|") {
      const group = groups[groups.length - 1];
      if (group) group.hasAlternation = true;
      atom = { kind: "none" };
      continue;
    }

    const quantifier = regexQuantifierAt(pattern, index);
    if (quantifier !== null && atom.kind !== "none") {
      if (
        quantifier.canRepeat &&
        atom.kind === "group" &&
        (atom.group.hasInnerVariableQuantifier || atom.group.hasAlternation)
      ) {
        return "nested variable quantifiers or repeated alternation can hang generation";
      }
      const group = groups[groups.length - 1];
      if (group && quantifier.canVary) {
        group.hasInnerVariableQuantifier = true;
      }
      index = quantifier.endIndex;
      if (pattern[index + 1] === "?") index += 1;
      atom = { kind: "none" };
      continue;
    }

    atom = { kind: "atom" };
  }

  return null;
}

function compileRegexKey(
  key: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
  context: KeyMatchContext,
): CompiledRegexKey | null {
  const parsedKey = parseRegexKey(key);
  if (!parsedKey) return null;

  const flags = regexEffectiveFlags(parsedKey.flags, activation);
  const cacheKey = `${parsedKey.pattern}/${flags}`;
  const cached = context.regexCache.get(cacheKey);
  if (cached) return cached;

  const unsafeReason = unsafeRegexPatternReason(parsedKey.pattern);
  if (unsafeReason) {
    const compiled = {
      regex: null,
      warning: `Unsafe regex key "${key.trim()}" treated as plaintext: ${unsafeReason}`,
    };
    context.regexCache.set(cacheKey, compiled);
    return compiled;
  }

  try {
    const compiled = {
      regex: new RegExp(parsedKey.pattern, flags),
      warning: null,
    };
    context.regexCache.set(cacheKey, compiled);
    return compiled;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const compiled = {
      regex: null,
      warning: `Invalid regex key "${key.trim()}" treated as plaintext: ${message}`,
    };
    context.regexCache.set(cacheKey, compiled);
    return compiled;
  }
}

function regexEffectiveFlags(
  flags: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
) {
  return activation.caseSensitiveKeys || flags.includes("i") ? flags : `${flags}i`;
}

function matchedRegexDedupeKey(regex: RegExp) {
  return `regex:${regex.source}/${regex.flags}`;
}

function plaintextDedupeKey(
  key: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
) {
  return `plain:${activation.caseSensitiveKeys ? key : key.toLowerCase()}`;
}

function isWordCharacter(value: string | undefined) {
  return !!value && /[A-Za-z0-9_]/.test(value);
}

function hasAsciiWordCharacter(value: string) {
  return /[A-Za-z0-9_]/.test(value);
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
    scanDepth === 0 ? [] : filledSources.slice(Math.max(0, filledSources.length - scanDepth));

  return selectedSources
    .map((source) => {
      const name = activation.includeNames ? source.name : "";
      return [name, source.body].filter(Boolean).join(": ");
    })
    .join("\n");
}

/**
 * Builds source buckets for entries that opt into companion/persona matching.
 * Entry `matchSources` flags decide which buckets join the transcript scan.
 */
export function buildMatchSources({
  activePersona = null,
  companions = [],
}: LorebookMatchSourceContext): LoreMatchSourceBuckets {
  const sources = emptyMatchSources();

  for (const companion of companions) {
    const name = cleanMatchSourceName(
      [companion.displayName, companion.nickname].filter(Boolean).join(" "),
    );
    for (const [bucket, field] of Object.entries(COMPANION_MATCH_SOURCE_FIELDS)) {
      sources[bucket as keyof typeof COMPANION_MATCH_SOURCE_FIELDS].push({
        name,
        body: companion[field],
      });
    }
  }

  if (activePersona) {
    sources.personaDescription.push({
      name: cleanMatchSourceName(
        [activePersona.displayName, activePersona.nickname].filter(Boolean).join(" "),
      ),
      body: activePersona.description,
    });
  }

  return sources;
}

function cleanMatchSourceName(value: string | null | undefined) {
  return value?.trim() || null;
}

function buildEntryScanBuffer({
  baseScanBuffer,
  matchSources,
  entry,
  activation,
}: {
  baseScanBuffer: string;
  matchSources: LoreMatchSourceBuckets;
  entry: LoreEntryRecord;
  activation: Pick<LorebookActivationSettings, "includeNames">;
}) {
  const enabledSources = entry.matchSources;
  if (!enabledSources) return baseScanBuffer;

  const sourceBlobs = (Object.keys(enabledSources) as LoreMatchSourceKey[])
    .filter((key) => enabledSources[key])
    .flatMap((key) => matchSources[key] ?? []);
  if (sourceBlobs.length === 0) return baseScanBuffer;

  const sourceBuffer = buildScanBuffer(sourceBlobs, {
    scanDepth: sourceBlobs.length,
    includeNames: activation.includeNames,
  });
  return [baseScanBuffer, sourceBuffer].filter(Boolean).join("\n");
}

function matchPlaintextKey(
  key: string,
  scanBuffer: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys" | "matchWholeWords">,
) {
  const trimmedKey = key.trim();
  if (!trimmedKey) return false;

  const haystack = activation.caseSensitiveKeys ? scanBuffer : scanBuffer.toLowerCase();
  const needle = activation.caseSensitiveKeys ? trimmedKey : trimmedKey.toLowerCase();

  // JavaScript word boundaries are ASCII-centric. For non-ASCII scripts such as
  // CJK, use substring matching instead of pretending whole-word detection is
  // reliable.
  if (!activation.matchWholeWords || !hasAsciiWordCharacter(needle)) {
    return haystack.includes(needle);
  }

  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : undefined;
    const after = haystack[index + needle.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    index = haystack.indexOf(needle, index + 1);
  }

  return false;
}

function matchKeyWithContext(
  key: string,
  scanBuffer: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys" | "matchWholeWords">,
  context: KeyMatchContext,
): KeyMatchResult {
  const trimmedKey = key.trim();
  if (!trimmedKey) return { matched: false, dedupeKey: "", warnings: [] };

  const compiledRegex = compileRegexKey(trimmedKey, activation, context);
  if (compiledRegex?.regex) {
    compiledRegex.regex.lastIndex = 0;
    return {
      matched: compiledRegex.regex.test(scanBuffer),
      dedupeKey: matchedRegexDedupeKey(compiledRegex.regex),
      warnings: [],
    };
  }

  const matched = matchPlaintextKey(trimmedKey, scanBuffer, activation);
  return {
    matched,
    dedupeKey: plaintextDedupeKey(trimmedKey, activation),
    warnings: compiledRegex?.warning ? [compiledRegex.warning] : [],
  };
}

export function matchKey(
  key: string,
  scanBuffer: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys" | "matchWholeWords">,
) {
  return matchKeyWithContext(key, scanBuffer, activation, createKeyMatchContext()).matched;
}

function entryHasBody(entry: LoreEntryRecord) {
  return entry.body.trim().length > 0;
}

function entryHasActivationPath(entry: LoreEntryRecord) {
  return (
    entry.strategy === "constant" || (entry.key?.some((key) => key.trim().length > 0) ?? false)
  );
}

function entryCanPossiblyActivate(entry: LoreEntryRecord) {
  return entry.enabled && entryHasBody(entry) && entryHasActivationPath(entry);
}

function entryCanPossiblyActivateFromRecursion(entry: LoreEntryRecord) {
  return entryCanPossiblyActivate(entry) && !resolveEntryRecursion(entry).nonRecursable;
}

function entryCanActivateFromSource(
  entry: LoreEntryRecord,
  activationSource: ActivationSource,
  recursionLevel: number,
) {
  const recursion = resolveEntryRecursion(entry);
  if (activationSource === "direct") return !recursion.delayUntilRecursion;
  if (recursion.nonRecursable) return false;
  return !recursion.delayUntilRecursion || recursionLevel >= recursion.recursionLevel;
}

function cleanUniqueKeys(
  keys: string[] | null | undefined,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
) {
  const uniqueKeys: string[] = [];
  const seenKeys = new Set<string>();
  for (const key of keys ?? []) {
    const trimmedKey = key.trim();
    if (!trimmedKey) continue;
    const dedupeKey = keyDedupeKey(trimmedKey, activation);
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    uniqueKeys.push(trimmedKey);
  }
  return uniqueKeys;
}

function keyDedupeKey(
  key: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
) {
  if (parseRegexKey(key)) return `regex:${key}`;
  return `plain:${activation.caseSensitiveKeys ? key : key.toLowerCase()}`;
}

function entryBelongsToInclusionGroup(entry: LoreEntryRecord) {
  return entry.inclusionGroup?.split(",").some((group) => group.trim().length > 0) ?? false;
}

function activateEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  sourceOrder: number,
  entryIndex: number,
  scanBuffer: string,
  matchSources: LoreMatchSourceBuckets,
  matchContext: KeyMatchContext,
  activationSource: ActivationSource,
  recursionLevel: number,
  options: ActivateEntryOptions = {},
): EntryActivationResult {
  if (!entry.enabled || !entryHasBody(entry)) {
    return { entry: null, warnings: [] };
  }
  if (!entryCanActivateFromSource(entry, activationSource, recursionLevel)) {
    return { entry: null, warnings: [] };
  }
  if (entry.strategy === "constant") {
    const entryRecursionLevel = activationSource === "recursion" ? recursionLevel : null;
    return {
      entry: {
        lorebookId: lorebook.id,
        lorebookTitle: lorebook.title,
        lorebookSummary: lorebook.summary,
        entry,
        matchReason: "constant",
        activationSource,
        matchedKey: null,
        matchedKeyCount: 0,
        warnings: [],
        sourceOrder,
        entryIndex,
        recursionLevel: entryRecursionLevel,
      },
      warnings: [],
    };
  }

  const entryScanBuffer = buildEntryScanBuffer({
    baseScanBuffer: scanBuffer,
    matchSources,
    entry,
    activation: lorebook.activation,
  });
  const primaryKeys = cleanUniqueKeys(entry.key, lorebook.activation);
  if (primaryKeys.length === 0) return { entry: null, warnings: [] };

  const primaryMatch = matchFirstKey(
    primaryKeys,
    entryScanBuffer,
    lorebook.activation,
    matchContext,
  );
  if (primaryMatch.matchedKeys.length === 0) {
    return { entry: null, warnings: uniqueWarnings(primaryMatch.warnings) };
  }

  const secondaryKeys = cleanUniqueKeys(entry.keySecondary, lorebook.activation);
  const secondaryMatch =
    secondaryKeys.length > 0
      ? matchAllKeys(secondaryKeys, entryScanBuffer, lorebook.activation, matchContext)
      : { matchedKeys: [], warnings: [] };

  if (
    secondaryKeys.length > 0 &&
    !secondaryMatchSatisfiesLogic(
      entry.selectiveLogic ?? "and-any",
      secondaryKeys.length,
      secondaryMatch.matchedKeys.length,
    )
  ) {
    return {
      entry: null,
      warnings: uniqueWarnings([...primaryMatch.warnings, ...secondaryMatch.warnings]),
    };
  }

  const primaryMatchCounter =
    options.mode !== "probe" &&
    lorebook.activation.useGroupScoring &&
    entryBelongsToInclusionGroup(entry)
      ? () => {
          const countedPrimaryMatch = matchAllKeys(
            primaryKeys,
            entryScanBuffer,
            lorebook.activation,
            matchContext,
            {
              dedupeMatchedKeys: true,
            },
          );
          return {
            matchedKeyCount: countedPrimaryMatch.matchedKeys.length,
            warnings: uniqueWarnings(countedPrimaryMatch.warnings),
          };
        }
      : undefined;
  const warnings = uniqueWarnings([...primaryMatch.warnings, ...secondaryMatch.warnings]);
  const entryRecursionLevel = activationSource === "recursion" ? recursionLevel : null;
  const activatedEntry: ActivatedLoreEntry = {
    lorebookId: lorebook.id,
    lorebookTitle: lorebook.title,
    lorebookSummary: lorebook.summary,
    entry,
    matchReason: "primary-key",
    activationSource,
    matchedKey: primaryMatch.matchedKeys[0] ?? null,
    matchedKeyCount: 1,
    warnings,
    sourceOrder,
    entryIndex,
    recursionLevel: entryRecursionLevel,
  };
  return {
    ...(primaryMatchCounter ? { primaryMatchCounter } : {}),
    entry: activatedEntry,
    warnings,
  };
}

function matchFirstKey(
  keys: string[],
  scanBuffer: string,
  activation: LorebookActivationSettings,
  context: KeyMatchContext,
) {
  const warnings: string[] = [];
  for (const key of keys) {
    const result = matchKeyWithContext(key, scanBuffer, activation, context);
    warnings.push(...result.warnings);
    if (result.matched) return { matchedKeys: [key], warnings };
  }
  return { matchedKeys: [], warnings };
}

function matchAllKeys(
  keys: string[],
  scanBuffer: string,
  activation: LorebookActivationSettings,
  context: KeyMatchContext,
  options: { dedupeMatchedKeys?: boolean } = {},
) {
  const matchedKeys: string[] = [];
  const matchedDedupeKeys = new Set<string>();
  const warnings: string[] = [];
  for (const key of keys) {
    const result = matchKeyWithContext(key, scanBuffer, activation, context);
    warnings.push(...result.warnings);
    if (!result.matched) continue;
    if (options.dedupeMatchedKeys) {
      if (matchedDedupeKeys.has(result.dedupeKey)) continue;
      matchedDedupeKeys.add(result.dedupeKey);
    }
    matchedKeys.push(key);
  }
  return { matchedKeys, warnings };
}

function secondaryMatchSatisfiesLogic(
  logic: NonNullable<LoreEntryRecord["selectiveLogic"]>,
  secondaryKeyCount: number,
  matchedSecondaryKeyCount: number,
) {
  switch (logic) {
    case "and-any":
      return matchedSecondaryKeyCount > 0;
    case "and-all":
      return matchedSecondaryKeyCount === secondaryKeyCount;
    case "not-any":
      return matchedSecondaryKeyCount === 0;
    case "not-all":
      return matchedSecondaryKeyCount < secondaryKeyCount;
  }
}

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings)];
}

/**
 * Sorts activated entries in prompt priority order. Higher insertion order wins;
 * equal order keeps lorebook/source order, then original entry order.
 */
export function sortActivatedEntries(entries: ActivatedLoreEntry[]) {
  return [...entries].sort(compareActivatedEntryOrder);
}

function budgetPriorityRank(entry: ActivatedLoreEntry) {
  const sourceRank = entry.activationSource === "direct" ? 0 : 1;
  const strategyRank = entry.entry.strategy === "constant" ? 0 : 1;
  return sourceRank * 2 + strategyRank;
}

function budgetPriorityEntries(entries: ActivatedLoreEntry[]) {
  return [...entries].sort((left, right) => {
    const priorityDelta = budgetPriorityRank(left) - budgetPriorityRank(right);
    return priorityDelta || compareActivatedEntryOrder(left, right);
  });
}

function approximateLoreEntryTokens(entry: ActivatedLoreEntry) {
  const promptText = `${entry.lorebookTitle} / ${entry.entry.title}: ${entry.entry.body.trim()}`;
  return Math.ceil(promptText.length / 4);
}

function resolveTokenBudget({
  budgetPercent,
  budgetTokens,
  contextTokens,
}: ApplyTokenBudgetOptions) {
  if (typeof budgetTokens === "number" && Number.isFinite(budgetTokens) && budgetTokens >= 0) {
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
 * budgets are only resolved when caller-provided context size is known. Budget
 * priority keeps direct activations before recursive activations, and constants
 * before selective entries within each activation source.
 */
export function applyTokenBudget(entries: ActivatedLoreEntry[], options: ApplyTokenBudgetOptions) {
  const budget = resolveTokenBudget(options);
  if (budget === null) return sortActivatedEntries(entries);

  const approxTokens = options.approxTokens ?? approximateLoreEntryTokens;
  const kept: ActivatedLoreEntry[] = [];
  let usedTokens =
    typeof options.reservedTokens === "number" && Number.isFinite(options.reservedTokens)
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
 * transcript scan text plus any supplied per-entry additional match sources,
 * including provenance for later prompt/debug surfaces. When the lorebook
 * enables recursive scans, activated entry bodies can activate further eligible
 * entries until no candidates remain or a recursion pass cap is reached. The
 * final activation result then resolves inclusion groups and applies per-entry
 * probability before callers apply budget trimming.
 */
export function activateLorebookEntries(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: LorebookActivationOptions = {},
) {
  return activateLorebookEntriesWithWarnings(lorebook, scanBuffer, options).entries;
}

interface ActivationEvaluationContext {
  sourceOrder: number;
  matchSources: LoreMatchSourceBuckets;
  matchContext: KeyMatchContext;
  primaryMatchCounters: Map<string, PrimaryMatchCounter>;
}

function runDirectScan(
  lorebook: LorebookRecord,
  scanBuffer: string,
  context: ActivationEvaluationContext,
): LorebookActivationResult {
  const entries: ActivatedLoreEntry[] = [];
  const warnings: string[] = [];

  for (const [entryIndex, entry] of lorebook.entries.entries()) {
    const activation = activateEntry(
      lorebook,
      entry,
      context.sourceOrder,
      entryIndex,
      scanBuffer,
      context.matchSources,
      context.matchContext,
      "direct",
      0,
    );
    warnings.push(...activation.warnings);
    if (activation.entry) {
      entries.push(activation.entry);
      if (activation.primaryMatchCounter) {
        context.primaryMatchCounters.set(activation.entry.entry.id, activation.primaryMatchCounter);
      }
    }
  }

  return { entries, warnings };
}

function recursionScanBodies(entries: ActivatedLoreEntry[]) {
  return entries
    .filter((entry) => !resolveEntryRecursion(entry.entry).preventFurther)
    .map((entry) => entry.entry.body.trim())
    .filter(Boolean);
}

function entryWouldActivateFromRecursion(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  entryIndex: number,
  scanBuffer: string,
  context: ActivationEvaluationContext,
  recursionLevel: number,
) {
  if (!entryCanPossiblyActivateFromRecursion(entry)) return false;
  return (
    activateEntry(
      lorebook,
      entry,
      context.sourceOrder,
      entryIndex,
      scanBuffer,
      context.matchSources,
      context.matchContext,
      "recursion",
      recursionLevel,
      { mode: "probe" },
    ).entry !== null
  );
}

function nextDelayedRecursionLevel(
  lorebook: LorebookRecord,
  activeEntryIds: Set<string>,
  currentLevel: number,
  recursionScanBuffer: string,
  context: ActivationEvaluationContext,
) {
  return lorebook.entries.reduce<number | null>((nextLevel, entry, entryIndex) => {
    if (activeEntryIds.has(entry.id)) return nextLevel;
    if (!entryCanPossiblyActivateFromRecursion(entry)) return nextLevel;
    const recursion = resolveEntryRecursion(entry);
    if (!recursion.delayUntilRecursion) return nextLevel;
    if (recursion.recursionLevel <= currentLevel) return nextLevel;
    if (
      !entryWouldActivateFromRecursion(
        lorebook,
        entry,
        entryIndex,
        recursionScanBuffer,
        context,
        recursion.recursionLevel,
      )
    ) {
      return nextLevel;
    }
    return nextLevel === null
      ? recursion.recursionLevel
      : Math.min(nextLevel, recursion.recursionLevel);
  }, null);
}

function hasRemainingRecursionCandidate(
  lorebook: LorebookRecord,
  activeEntryIds: Set<string>,
  recursionScanBuffer: string,
  context: ActivationEvaluationContext,
  recursionLevel: number,
) {
  return lorebook.entries.some(
    (entry, entryIndex) =>
      !activeEntryIds.has(entry.id) &&
      entryWouldActivateFromRecursion(
        lorebook,
        entry,
        entryIndex,
        recursionScanBuffer,
        context,
        recursionLevel,
      ),
  );
}

function runRecursionPasses({
  context,
  entries,
  lorebook,
  scanBuffer,
  warnings,
}: {
  context: ActivationEvaluationContext;
  entries: ActivatedLoreEntry[];
  lorebook: LorebookRecord;
  scanBuffer: string;
  warnings: string[];
}): LorebookActivationResult {
  const activeEntryIds = new Set(entries.map((entry) => entry.entry.id));
  const recursionBodies = recursionScanBodies(entries);
  if (recursionBodies.length === 0) {
    return { entries, warnings };
  }

  let recursionScanBuffer = [scanBuffer.trim(), ...recursionBodies].filter(Boolean).join("\n");
  let recursionLevel = 0;
  let passCount = 0;
  const maxRecursionSteps = lorebook.activation.maxRecursionSteps;

  while (true) {
    if (maxRecursionSteps > 0 && passCount >= maxRecursionSteps) break;
    if (passCount >= LOREBOOK_RECURSION_HARD_PASS_CAP) {
      warnings.push(
        `Lorebook "${lorebook.title}" recursion stopped after ${LOREBOOK_RECURSION_HARD_PASS_CAP} passes.`,
      );
      break;
    }

    const recursiveEntries: ActivatedLoreEntry[] = [];

    for (const [entryIndex, entry] of lorebook.entries.entries()) {
      if (activeEntryIds.has(entry.id)) continue;
      const activation = activateEntry(
        lorebook,
        entry,
        context.sourceOrder,
        entryIndex,
        recursionScanBuffer,
        context.matchSources,
        context.matchContext,
        "recursion",
        recursionLevel,
      );
      warnings.push(...activation.warnings);
      if (!activation.entry) continue;
      recursiveEntries.push(activation.entry);
      if (activation.primaryMatchCounter) {
        context.primaryMatchCounters.set(activation.entry.entry.id, activation.primaryMatchCounter);
      }
      activeEntryIds.add(entry.id);
    }

    // This cap counts every recursion sweep, including sweeps that only open
    // the next delayed level. That keeps delayed level ladders bounded too.
    passCount += 1;

    if (recursiveEntries.length > 0) {
      entries.push(...recursiveEntries);
      const newBodies = recursionScanBodies(recursiveEntries);
      if (newBodies.length > 0) {
        recursionScanBuffer = [recursionScanBuffer, ...newBodies].join("\n");
        if (
          hasRemainingRecursionCandidate(
            lorebook,
            activeEntryIds,
            recursionScanBuffer,
            context,
            recursionLevel,
          )
        ) {
          continue;
        }
      }
    }

    const nextRecursionLevel = nextDelayedRecursionLevel(
      lorebook,
      activeEntryIds,
      recursionLevel,
      recursionScanBuffer,
      context,
    );
    if (nextRecursionLevel === null) break;
    recursionLevel = nextRecursionLevel;
  }

  return { entries, warnings };
}

export function activateLorebookEntriesWithWarnings(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: LorebookActivationOptions = {},
): LorebookActivationResult {
  const rand = options.rand ?? Math.random;
  const context: ActivationEvaluationContext = {
    sourceOrder: options.sourceOrder ?? 0,
    matchSources: options.matchSources ?? EMPTY_MATCH_SOURCES,
    matchContext: createKeyMatchContext(),
    primaryMatchCounters: new Map(),
  };
  const countPrimaryMatches = (entry: ActivatedLoreEntry) =>
    context.primaryMatchCounters.get(entry.entry.id)?.() ?? {
      matchedKeyCount: entry.matchedKeyCount,
      warnings: [],
    };
  const { entries, warnings } = runDirectScan(lorebook, scanBuffer, context);

  if (!lorebook.activation.recursiveScan || entries.length === 0) {
    return finalizeActivationResult({
      activation: lorebook.activation,
      countPrimaryMatches,
      entries,
      rand,
      warnings,
    });
  }

  const activation = runRecursionPasses({ context, entries, lorebook, scanBuffer, warnings });
  return finalizeActivationResult({
    activation: lorebook.activation,
    countPrimaryMatches,
    entries: activation.entries,
    rand,
    warnings: activation.warnings,
  });
}
