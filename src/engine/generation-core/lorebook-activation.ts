import type {
  LorebookActivationSettings,
  LorebookRecord,
  LoreEntryRecord,
  LoreMatchSources,
} from "../contracts/types/lorebook";
import type { CharacterRecord } from "../contracts/types/character";
import type { PersonaRecord } from "../contracts/types/persona";

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

/** Activated entry plus match provenance, ordering, and summary metadata. */
export interface ActivatedLoreEntry {
  lorebookId: string;
  lorebookTitle: string;
  lorebookSummary: string;
  entry: LoreEntryRecord;
  matchReason: "constant" | "primary-key";
  matchedKey: string | null;
  warnings: string[];
  sourceOrder: number;
  entryIndex: number;
}

/** Activated lore entries plus warnings discovered while evaluating keys. */
export interface LorebookActivationResult {
  entries: ActivatedLoreEntry[];
  warnings: string[];
}

/** Options for trimming activated lore with absolute or context-percent caps. */
export interface ApplyTokenBudgetOptions {
  budgetTokens?: number | null;
  budgetPercent?: number | null;
  contextTokens?: number | null;
  approxTokens?: (entry: ActivatedLoreEntry) => number;
  reservedTokens?: number;
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
  warnings: string[];
}

interface EntryActivationResult {
  entry: ActivatedLoreEntry | null;
  warnings: string[];
}

interface RegexGroupSafety {
  hasInnerVariableQuantifier: boolean;
  hasAlternation: boolean;
}

type RegexSafetyAtom =
  | { kind: "group"; group: RegexGroupSafety }
  | { kind: "atom" }
  | { kind: "none" };

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

const COMPANION_MATCH_SOURCE_FIELDS = {
  characterDescription: "description",
  characterPersonality: "personality",
  scenario: "scenario",
  characterNote: "characterNote",
} as const satisfies Record<Exclude<LoreMatchSourceKey, "personaDescription">, keyof CharacterRecord>;

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
  const maximum =
    match[2] === undefined
      ? minimum
      : match[2] === ""
        ? Infinity
        : Number(match[2]);

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
        parentGroup.hasInnerVariableQuantifier ||=
          group.hasInnerVariableQuantifier;
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

  const flags =
    activation.caseSensitiveKeys || parsedKey.flags.includes("i")
      ? parsedKey.flags
      : `${parsedKey.flags}i`;
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
    for (const [bucket, field] of Object.entries(
      COMPANION_MATCH_SOURCE_FIELDS,
    )) {
      sources[bucket as keyof typeof COMPANION_MATCH_SOURCE_FIELDS].push({
        name,
        body: companion[field],
      });
    }
  }

  if (activePersona) {
    sources.personaDescription.push({
      name: cleanMatchSourceName(
        [activePersona.displayName, activePersona.nickname]
          .filter(Boolean)
          .join(" "),
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
  activation: Pick<
    LorebookActivationSettings,
    "caseSensitiveKeys" | "matchWholeWords"
  >,
) {
  const trimmedKey = key.trim();
  if (!trimmedKey) return false;

  const haystack = activation.caseSensitiveKeys
    ? scanBuffer
    : scanBuffer.toLowerCase();
  const needle = activation.caseSensitiveKeys
    ? trimmedKey
    : trimmedKey.toLowerCase();

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
  activation: Pick<
    LorebookActivationSettings,
    "caseSensitiveKeys" | "matchWholeWords"
  >,
  context: KeyMatchContext,
): KeyMatchResult {
  const trimmedKey = key.trim();
  if (!trimmedKey) return { matched: false, warnings: [] };

  const compiledRegex = compileRegexKey(trimmedKey, activation, context);
  if (compiledRegex?.regex) {
    compiledRegex.regex.lastIndex = 0;
    return {
      matched: compiledRegex.regex.test(scanBuffer),
      warnings: [],
    };
  }

  const matched = matchPlaintextKey(trimmedKey, scanBuffer, activation);
  return {
    matched,
    warnings: compiledRegex?.warning ? [compiledRegex.warning] : [],
  };
}

export function matchKey(
  key: string,
  scanBuffer: string,
  activation: Pick<
    LorebookActivationSettings,
    "caseSensitiveKeys" | "matchWholeWords"
  >,
) {
  return matchKeyWithContext(
    key,
    scanBuffer,
    activation,
    createKeyMatchContext(),
  ).matched;
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
  matchSources: LoreMatchSourceBuckets,
  matchContext: KeyMatchContext,
): EntryActivationResult {
  if (!entry.enabled || !entryHasBody(entry)) {
    return { entry: null, warnings: [] };
  }
  if (entry.strategy === "constant") {
    return {
      entry: {
        lorebookId: lorebook.id,
        lorebookTitle: lorebook.title,
        lorebookSummary: lorebook.summary,
        entry,
        matchReason: "constant",
        matchedKey: null,
        warnings: [],
        sourceOrder,
        entryIndex,
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
  const primaryKeys = entry.key?.map((key) => key.trim()).filter(Boolean) ?? [];
  if (primaryKeys.length === 0) return { entry: null, warnings: [] };

  const primaryMatch = matchFirstKey(
    primaryKeys,
    entryScanBuffer,
    lorebook.activation,
    matchContext,
  );
  if (!primaryMatch.matchedKey) {
    return { entry: null, warnings: uniqueWarnings(primaryMatch.warnings) };
  }

  const secondaryKeys =
    entry.keySecondary?.map((key) => key.trim()).filter(Boolean) ?? [];
  const secondaryMatch =
    secondaryKeys.length > 0
      ? matchAllKeys(
          secondaryKeys,
          entryScanBuffer,
          lorebook.activation,
          matchContext,
        )
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
      warnings: uniqueWarnings([
        ...primaryMatch.warnings,
        ...secondaryMatch.warnings,
      ]),
    };
  }

  const warnings = uniqueWarnings([
    ...primaryMatch.warnings,
    ...secondaryMatch.warnings,
  ]);
  return {
    entry: {
      lorebookId: lorebook.id,
      lorebookTitle: lorebook.title,
      lorebookSummary: lorebook.summary,
      entry,
      matchReason: "primary-key",
      matchedKey: primaryMatch.matchedKey,
      warnings,
      sourceOrder,
      entryIndex,
    },
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
    if (result.matched) {
      return { matchedKey: key, warnings };
    }
  }
  return { matchedKey: null, warnings };
}

function matchAllKeys(
  keys: string[],
  scanBuffer: string,
  activation: LorebookActivationSettings,
  context: KeyMatchContext,
) {
  const matchedKeys: string[] = [];
  const warnings: string[] = [];
  for (const key of keys) {
    const result = matchKeyWithContext(key, scanBuffer, activation, context);
    warnings.push(...result.warnings);
    if (result.matched) matchedKeys.push(key);
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
 * transcript scan text plus any supplied per-entry additional match sources,
 * including provenance for later prompt/debug surfaces.
 */
export function activateLorebookEntries(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: { sourceOrder?: number; matchSources?: LoreMatchSourceBuckets } = {},
) {
  return activateLorebookEntriesWithWarnings(lorebook, scanBuffer, options)
    .entries;
}

export function activateLorebookEntriesWithWarnings(
  lorebook: LorebookRecord,
  scanBuffer: string,
  options: { sourceOrder?: number; matchSources?: LoreMatchSourceBuckets } = {},
): LorebookActivationResult {
  const sourceOrder = options.sourceOrder ?? 0;
  const matchSources = options.matchSources ?? EMPTY_MATCH_SOURCES;
  const matchContext = createKeyMatchContext();
  const entries: ActivatedLoreEntry[] = [];
  const warnings: string[] = [];

  for (const [entryIndex, entry] of lorebook.entries.entries()) {
    const activation = activateEntry(
      lorebook,
      entry,
      sourceOrder,
      entryIndex,
      scanBuffer,
      matchSources,
      matchContext,
    );
    warnings.push(...activation.warnings);
    if (activation.entry) entries.push(activation.entry);
  }

  return { entries, warnings: uniqueWarnings(warnings) };
}
