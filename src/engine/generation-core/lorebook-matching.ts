import type { CharacterRecord } from "../contracts/types/character";
import type {
  LorebookActivationSettings,
  LoreEntryRecord,
  LoreMatchSources,
} from "../contracts/types/lorebook";
import type { PersonaRecord } from "../contracts/types/persona";
import { errorMessage } from "../shared/errors";

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

export type LoreMatchSourceBuckets = Record<LoreMatchSourceKey, LorebookScanSource[]>;

interface CompiledRegexKey {
  regex: RegExp | null;
  warning: string | null;
}

export interface PrimaryMatchCountResult {
  matchedKeyCount: number;
  warnings: string[];
}

interface KeyMatchResult {
  matched: boolean;
  dedupeKey: string;
  warnings: string[];
}

export type PrimaryMatchCounter = () => PrimaryMatchCountResult;

interface LoreEntryMatchResult {
  matchedKey: string | null;
  primaryMatchCounter?: PrimaryMatchCounter;
  warnings: string[];
}

interface RegexGroupSafety {
  hasInnerVariableQuantifier: boolean;
  hasAlternation: boolean;
  outerVariableAtomChain: string[];
}

type RegexSafetyAtom =
  { kind: "group"; group: RegexGroupSafety } | { kind: "atom" } | { kind: "none" };

const COMPANION_MATCH_SOURCE_FIELDS = {
  characterDescription: "description",
  characterPersonality: "personality",
  scenario: "scenario",
  characterNote: "characterNote",
} as const satisfies Record<
  Exclude<LoreMatchSourceKey, "personaDescription">,
  keyof CharacterRecord
>;

type RegexCache = Map<string, CompiledRegexKey>;

export function emptyMatchSources(): LoreMatchSourceBuckets {
  return {
    characterDescription: [],
    characterPersonality: [],
    scenario: [],
    characterNote: [],
    personaDescription: [],
  };
}

function parseRegexKey(key: string) {
  const match = key.trim().match(/^\/(.+)\/([A-Za-z]*)$/);
  if (!match) return null;
  const pattern = match[1];
  const flags = match[2] ?? "";
  if (pattern === undefined) return null;
  return { pattern, flags };
}

function regexQuantifierAt(pattern: string, index: number) {
  const char = pattern[index];
  if (char === "*" || char === "+") {
    return { endIndex: index, canRepeat: true, canVary: true, canBeEmpty: char === "*" };
  }
  if (char === "?") {
    return { endIndex: index, canRepeat: false, canVary: true, canBeEmpty: true };
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
    canBeEmpty: minimum === 0,
  };
}

const UNKNOWN_REGEX_ATOM = "unknown";

function literalRegexAtomIdentity(char: string, flags: string) {
  if (!/^[\x20-\x7e]$/.test(char)) return UNKNOWN_REGEX_ATOM;
  return `literal:${flags.includes("i") ? char.toLowerCase() : char}`;
}

function regexAtomsAreProvenDisjoint(left: string, right: string) {
  return left.startsWith("literal:") && right.startsWith("literal:") && left !== right;
}

function unsafeRegexPatternReason(pattern: string, flags: string) {
  const groups: RegexGroupSafety[] = [];
  let atom: RegexSafetyAtom = { kind: "none" };
  let atomIdentity: string | null = null;
  let variableAtomChain: string[] = [];
  let escaped = false;
  let inCharacterClass = false;

  const beginAtom = (identity: string) => {
    if (atom.kind !== "none") variableAtomChain = [];
    atom = { kind: "atom" };
    atomIdentity = identity;
  };

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];

    if (escaped) {
      escaped = false;
      if (!inCharacterClass) {
        if (/^[1-9]$/.test(char) || (char === "k" && pattern[index + 1] === "<")) {
          return "backreferences can cause catastrophic matching work";
        }
        if (char !== "b" && char !== "B") beginAtom(UNKNOWN_REGEX_ATOM);
      }
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (inCharacterClass) {
      if (char === "]") {
        inCharacterClass = false;
        beginAtom(UNKNOWN_REGEX_ATOM);
      }
      continue;
    }
    if (char === "[") {
      if (atom.kind !== "none") variableAtomChain = [];
      inCharacterClass = true;
      atom = { kind: "none" };
      atomIdentity = null;
      continue;
    }
    if (char === "(") {
      if (atom.kind !== "none") variableAtomChain = [];
      groups.push({
        hasInnerVariableQuantifier: false,
        hasAlternation: false,
        outerVariableAtomChain: variableAtomChain,
      });
      atom = { kind: "none" };
      atomIdentity = null;
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
      variableAtomChain = group.outerVariableAtomChain;
      atom = { kind: "group", group };
      atomIdentity = UNKNOWN_REGEX_ATOM;
      continue;
    }
    if (char === "|") {
      const group = groups[groups.length - 1];
      if (group) group.hasAlternation = true;
      atom = { kind: "none" };
      atomIdentity = null;
      variableAtomChain = [];
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
      const currentAtomIdentity = atomIdentity;
      if (
        quantifier.canVary &&
        currentAtomIdentity !== null &&
        variableAtomChain.some(
          (previousIdentity) => !regexAtomsAreProvenDisjoint(previousIdentity, currentAtomIdentity),
        )
      ) {
        return "overlapping sequential variable quantifiers can hang generation";
      }
      const group = groups[groups.length - 1];
      if (group && quantifier.canVary) group.hasInnerVariableQuantifier = true;
      variableAtomChain = quantifier.canVary
        ? quantifier.canBeEmpty
          ? [...variableAtomChain, ...(atomIdentity === null ? [] : [atomIdentity])]
          : atomIdentity === null
            ? []
            : [atomIdentity]
        : [];
      index = quantifier.endIndex;
      if (pattern[index + 1] === "?") index += 1;
      atom = { kind: "none" };
      atomIdentity = null;
      continue;
    }
    if (char === "^" || char === "$") {
      atom = { kind: "none" };
      atomIdentity = null;
      continue;
    }
    beginAtom(char === "." ? UNKNOWN_REGEX_ATOM : literalRegexAtomIdentity(char, flags));
  }

  return null;
}

function regexEffectiveFlags(
  flags: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
) {
  return activation.caseSensitiveKeys || flags.includes("i") ? flags : `${flags}i`;
}

function compileRegexKey(
  key: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys">,
  regexCache: RegexCache,
): CompiledRegexKey | null {
  const parsedKey = parseRegexKey(key);
  if (!parsedKey) return null;

  const flags = regexEffectiveFlags(parsedKey.flags, activation);
  const cacheKey = `${parsedKey.pattern}/${flags}`;
  const cached = regexCache.get(cacheKey);
  if (cached) return cached;

  const unsafeReason = unsafeRegexPatternReason(parsedKey.pattern, flags);
  if (unsafeReason) {
    const compiled = {
      regex: null,
      warning: `Unsafe regex key "${key.trim()}" treated as plaintext: ${unsafeReason}`,
    };
    regexCache.set(cacheKey, compiled);
    return compiled;
  }

  try {
    const compiled = { regex: new RegExp(parsedKey.pattern, flags), warning: null };
    regexCache.set(cacheKey, compiled);
    return compiled;
  } catch (error) {
    const compiled = {
      regex: null,
      warning: `Invalid regex key "${key.trim()}" treated as plaintext: ${errorMessage(error)}`,
    };
    regexCache.set(cacheKey, compiled);
    return compiled;
  }
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

/** Builds the transcript slice scanned by selective lore entries. */
export function buildScanBuffer(
  sources: LorebookScanSource[],
  activation: Pick<LorebookActivationSettings, "scanDepth" | "includeNames">,
) {
  const scanDepth = Math.max(0, activation.scanDepth);
  const filledSources = sources.flatMap((source) => {
    const body = source.body?.trim() ?? "";
    if (!body) return [];
    return [{ name: source.name?.trim() ?? "", body }];
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

/** Builds companion/persona source buckets for entries that enable them. */
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
  if (!activation.matchWholeWords || !hasAsciiWordCharacter(needle))
    return haystack.includes(needle);

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
  regexCache: RegexCache,
): KeyMatchResult {
  const trimmedKey = key.trim();
  if (!trimmedKey) return { matched: false, dedupeKey: "", warnings: [] };
  const compiledRegex = compileRegexKey(trimmedKey, activation, regexCache);
  if (compiledRegex?.regex) {
    compiledRegex.regex.lastIndex = 0;
    return {
      matched: compiledRegex.regex.test(scanBuffer),
      dedupeKey: matchedRegexDedupeKey(compiledRegex.regex),
      warnings: [],
    };
  }
  return {
    matched: matchPlaintextKey(trimmedKey, scanBuffer, activation),
    dedupeKey: plaintextDedupeKey(trimmedKey, activation),
    warnings: compiledRegex?.warning ? [compiledRegex.warning] : [],
  };
}

export function matchKey(
  key: string,
  scanBuffer: string,
  activation: Pick<LorebookActivationSettings, "caseSensitiveKeys" | "matchWholeWords">,
) {
  return matchKeyWithContext(key, scanBuffer, activation, new Map()).matched;
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
    const dedupeKey = parseRegexKey(trimmedKey)
      ? `regex:${trimmedKey}`
      : plaintextDedupeKey(trimmedKey, activation);
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);
    uniqueKeys.push(trimmedKey);
  }
  return uniqueKeys;
}

function matchKeys(
  keys: string[],
  scanBuffer: string,
  activation: LorebookActivationSettings,
  regexCache: RegexCache,
  options: { stopAfterFirst?: boolean; dedupeMatchedKeys?: boolean } = {},
) {
  const matchedKeys: string[] = [];
  const matchedDedupeKeys = new Set<string>();
  const warnings: string[] = [];
  for (const key of keys) {
    const result = matchKeyWithContext(key, scanBuffer, activation, regexCache);
    warnings.push(...result.warnings);
    if (!result.matched) continue;
    if (options.dedupeMatchedKeys) {
      if (matchedDedupeKeys.has(result.dedupeKey)) continue;
      matchedDedupeKeys.add(result.dedupeKey);
    }
    matchedKeys.push(key);
    if (options.stopAfterFirst) break;
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

interface LorebookMatchOptions {
  activation: LorebookActivationSettings;
  baseScanBuffer: string;
  countPrimaryMatches: boolean;
  entry: LoreEntryRecord;
  matchSources: LoreMatchSourceBuckets;
}

export type LorebookMatcher = (options: LorebookMatchOptions) => LoreEntryMatchResult;

function matchLoreEntryKeysWithCache({
  activation,
  baseScanBuffer,
  countPrimaryMatches,
  entry,
  matchSources,
  regexCache,
}: {
  regexCache: RegexCache;
} & LorebookMatchOptions): LoreEntryMatchResult {
  const entryScanBuffer = buildEntryScanBuffer({
    baseScanBuffer,
    matchSources,
    entry,
    activation,
  });
  const primaryKeys = cleanUniqueKeys(entry.key, activation);
  if (primaryKeys.length === 0) return { matchedKey: null, warnings: [] };

  const primaryMatch = matchKeys(primaryKeys, entryScanBuffer, activation, regexCache, {
    stopAfterFirst: true,
  });
  if (primaryMatch.matchedKeys.length === 0) {
    return { matchedKey: null, warnings: uniqueWarnings(primaryMatch.warnings) };
  }

  const secondaryKeys = cleanUniqueKeys(entry.keySecondary, activation);
  const secondaryMatch =
    secondaryKeys.length > 0
      ? matchKeys(secondaryKeys, entryScanBuffer, activation, regexCache)
      : { matchedKeys: [], warnings: [] };
  const warnings = uniqueWarnings([...primaryMatch.warnings, ...secondaryMatch.warnings]);
  if (
    secondaryKeys.length > 0 &&
    !secondaryMatchSatisfiesLogic(
      entry.selectiveLogic ?? "and-any",
      secondaryKeys.length,
      secondaryMatch.matchedKeys.length,
    )
  ) {
    return { matchedKey: null, warnings };
  }

  const primaryMatchCounter = countPrimaryMatches
    ? () => {
        const counted = matchKeys(primaryKeys, entryScanBuffer, activation, regexCache, {
          dedupeMatchedKeys: true,
        });
        return {
          matchedKeyCount: counted.matchedKeys.length,
          warnings: uniqueWarnings(counted.warnings),
        };
      }
    : undefined;

  return {
    matchedKey: primaryMatch.matchedKeys[0] ?? null,
    ...(primaryMatchCounter ? { primaryMatchCounter } : {}),
    warnings,
  };
}

/** Creates a matcher whose regex cache is private to one activation evaluation. */
export function createLorebookMatcher(): LorebookMatcher {
  const regexCache: RegexCache = new Map();
  return (options) => matchLoreEntryKeysWithCache({ ...options, regexCache });
}
