import type {
  LoreCharacterFilter,
  LorebookActivationSettings,
  LorebookRecord,
  LoreEntryRecord,
  LoreEntryRecursion,
  LoreEntryRole,
  LoreEntryStrategy,
  LoreEntryTiming,
  LoreEntryTriggers,
  LoreInsertionPosition,
  LoreMatchSources,
  LoreSelectiveLogic,
} from "../contracts/types/lorebook";
import {
  DEFAULT_LOREBOOK_ACTIVATION,
  DEFAULT_LORE_ENTRY_RECURSION,
} from "../contracts/types/lorebook";

export interface LorebookEntryInput {
  title: string;
  body?: string;
  enabled?: boolean;
  key?: string[] | null;
  keySecondary?: string[] | null;
  selectiveLogic?: LoreSelectiveLogic | null;
  strategy?: LoreEntryStrategy;
  probability?: number;
  inclusionGroup?: string | null;
  insertionPosition?: LoreInsertionPosition;
  insertionOrder?: number;
  depth?: number | null;
  role?: LoreEntryRole | null;
  recursion?: LoreEntryRecursion | null;
  timing?: LoreEntryTiming | null;
  triggers?: LoreEntryTriggers | null;
  characterFilter?: LoreCharacterFilter | null;
  matchSources?: LoreMatchSources | null;
}

export interface LorebookInput {
  title: string;
  summary?: string;
  activation?: Partial<LorebookActivationSettings>;
}

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanNullableText(value: string | null | undefined) {
  return value?.trim() || null;
}

function cleanStringList(value: string[] | null | undefined) {
  if (!value) return null;
  const cleaned = value.map((item) => item.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : null;
}

function definedOrFallback<T>(value: T | undefined, fallback: T) {
  return value === undefined ? fallback : value;
}

function readFiniteNumber(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNonNegativeInteger(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function readNullableNonNegativeInteger(value: number | null | undefined, fallback: number | null) {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function readProbability(value: number | undefined, fallback = 100) {
  const probability = readFiniteNumber(value, fallback);
  return Math.min(100, Math.max(0, probability));
}

function readNullablePercent(value: number | null | undefined, fallback: number | null) {
  if (value === null) return null;
  const percent = readNullableNonNegativeInteger(value, fallback);
  return typeof percent === "number" ? Math.min(100, percent) : percent;
}

function activationWithDefaults(
  activation: Partial<LorebookActivationSettings> | undefined,
  fallback: LorebookActivationSettings = DEFAULT_LOREBOOK_ACTIVATION,
): LorebookActivationSettings {
  return {
    scanDepth: readNonNegativeInteger(activation?.scanDepth, fallback.scanDepth),
    includeNames: definedOrFallback(activation?.includeNames, fallback.includeNames),
    caseSensitiveKeys: definedOrFallback(activation?.caseSensitiveKeys, fallback.caseSensitiveKeys),
    matchWholeWords: definedOrFallback(activation?.matchWholeWords, fallback.matchWholeWords),
    recursiveScan: definedOrFallback(activation?.recursiveScan, fallback.recursiveScan),
    maxRecursionSteps: readNonNegativeInteger(
      activation?.maxRecursionSteps,
      fallback.maxRecursionSteps,
    ),
    budgetTokens: readNullableNonNegativeInteger(activation?.budgetTokens, fallback.budgetTokens),
    budgetPercent: readNullablePercent(activation?.budgetPercent, fallback.budgetPercent),
  };
}

function normalizeEntryRecursion(
  value: LoreEntryRecursion | null | undefined,
  fallback: LoreEntryRecursion | null,
) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return {
    nonRecursable:
      typeof value.nonRecursable === "boolean"
        ? value.nonRecursable
        : (fallback?.nonRecursable ?? DEFAULT_LORE_ENTRY_RECURSION.nonRecursable),
    preventFurther:
      typeof value.preventFurther === "boolean"
        ? value.preventFurther
        : (fallback?.preventFurther ?? DEFAULT_LORE_ENTRY_RECURSION.preventFurther),
    delayUntilRecursion:
      typeof value.delayUntilRecursion === "boolean"
        ? value.delayUntilRecursion
        : (fallback?.delayUntilRecursion ?? DEFAULT_LORE_ENTRY_RECURSION.delayUntilRecursion),
    recursionLevel: readNonNegativeInteger(
      value.recursionLevel,
      fallback?.recursionLevel ?? DEFAULT_LORE_ENTRY_RECURSION.recursionLevel,
    ),
  };
}

function normalizeEntryTiming(
  value: LoreEntryTiming | null | undefined,
  fallback: LoreEntryTiming | null,
) {
  if (value === undefined) return fallback;
  if (value === null) return null;
  return {
    sticky: readNonNegativeInteger(value.sticky, fallback?.sticky ?? 0),
    cooldown: readNonNegativeInteger(value.cooldown, fallback?.cooldown ?? 0),
    delay: readNonNegativeInteger(value.delay, fallback?.delay ?? 0),
  };
}

export function createLorebookRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: LorebookInput;
  now: string;
}): LorebookRecord {
  return {
    id,
    schemaVersion: 2,
    title: cleanText(input.title, "Untitled lorebook"),
    summary: cleanText(input.summary),
    activation: activationWithDefaults(input.activation),
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLorebookRecord(
  record: LorebookRecord,
  input: LorebookInput,
  updatedAt: string,
): LorebookRecord {
  return {
    ...record,
    title: cleanText(input.title, record.title),
    summary: cleanText(input.summary),
    activation: activationWithDefaults(input.activation, record.activation),
    updatedAt,
  };
}

export function createLorebookEntryRecord({
  id,
  input,
  now,
}: {
  id: string;
  input: LorebookEntryInput;
  now: string;
}): LoreEntryRecord {
  return {
    id,
    schemaVersion: 2,
    title: cleanText(input.title, "Untitled note"),
    body: cleanText(input.body),
    enabled: input.enabled ?? true,
    key: cleanStringList(input.key),
    keySecondary: cleanStringList(input.keySecondary),
    selectiveLogic: input.selectiveLogic ?? null,
    strategy: input.strategy ?? "constant",
    probability: readProbability(input.probability),
    inclusionGroup: cleanNullableText(input.inclusionGroup),
    insertionPosition: input.insertionPosition ?? "after-character",
    insertionOrder: readFiniteNumber(input.insertionOrder, 100),
    depth: readNullableNonNegativeInteger(input.depth, null),
    role: input.role ?? null,
    recursion: normalizeEntryRecursion(input.recursion, null),
    timing: normalizeEntryTiming(input.timing, null),
    triggers: input.triggers ?? null,
    characterFilter: input.characterFilter ?? null,
    matchSources: input.matchSources ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateLorebookEntryRecord(
  record: LoreEntryRecord,
  input: LorebookEntryInput,
  updatedAt: string,
): LoreEntryRecord {
  return {
    ...record,
    title: cleanText(input.title, record.title),
    body: input.body === undefined ? record.body : cleanText(input.body),
    enabled: input.enabled ?? record.enabled,
    key: input.key === undefined ? record.key : cleanStringList(input.key),
    keySecondary:
      input.keySecondary === undefined ? record.keySecondary : cleanStringList(input.keySecondary),
    selectiveLogic:
      input.selectiveLogic === undefined ? record.selectiveLogic : input.selectiveLogic,
    strategy: input.strategy ?? record.strategy,
    probability:
      input.probability === undefined
        ? record.probability
        : readProbability(input.probability, record.probability),
    inclusionGroup:
      input.inclusionGroup === undefined
        ? record.inclusionGroup
        : cleanNullableText(input.inclusionGroup),
    insertionPosition: input.insertionPosition ?? record.insertionPosition,
    insertionOrder: readFiniteNumber(input.insertionOrder, record.insertionOrder),
    depth:
      input.depth === undefined
        ? record.depth
        : readNullableNonNegativeInteger(input.depth, record.depth),
    role: input.role === undefined ? record.role : input.role,
    recursion: normalizeEntryRecursion(input.recursion, record.recursion),
    timing: normalizeEntryTiming(input.timing, record.timing),
    triggers: input.triggers === undefined ? record.triggers : input.triggers,
    characterFilter:
      input.characterFilter === undefined ? record.characterFilter : input.characterFilter,
    matchSources: input.matchSources === undefined ? record.matchSources : input.matchSources,
    updatedAt,
  };
}

export function duplicateLorebookEntryRecord(
  record: LoreEntryRecord,
  id: string,
  now: string,
): LoreEntryRecord {
  return {
    ...record,
    id,
    title: `${record.title} Copy`,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertLorebookEntry(
  lorebook: LorebookRecord,
  entry: LoreEntryRecord,
  updatedAt: string,
): LorebookRecord {
  const exists = lorebook.entries.some((currentEntry) => currentEntry.id === entry.id);
  return {
    ...lorebook,
    entries: exists
      ? lorebook.entries.map((currentEntry) =>
          currentEntry.id === entry.id ? entry : currentEntry,
        )
      : [entry, ...lorebook.entries],
    updatedAt,
  };
}

export function deleteLorebookEntry(
  lorebook: LorebookRecord,
  entryId: string,
  updatedAt: string,
): LorebookRecord {
  return {
    ...lorebook,
    entries: lorebook.entries.filter((entry) => entry.id !== entryId),
    updatedAt,
  };
}

export function deleteLorebookRecord(records: LorebookRecord[], id: string) {
  return records.filter((record) => record.id !== id);
}
