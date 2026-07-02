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
  LoreGenerationTriggerType,
  LoreInsertionPosition,
  LoreMatchSources,
  LoreSelectiveLogic,
} from "../../../engine/contracts/types/lorebook";
import { DEFAULT_LOREBOOK_ACTIVATION } from "../../../engine/contracts/types/lorebook";
import {
  isRecord,
  readString,
  readStringArray,
  readTimestamp,
} from "../storage-json";
import { createStorageRepository } from "../storage-repository-factory";
import { STORAGE_ENTITIES } from "../storage-entities";

const LORE_ENTRY_STRATEGIES = new Set<LoreEntryStrategy>([
  "selective",
  "constant",
]);
const LORE_SELECTIVE_LOGIC = new Set<LoreSelectiveLogic>([
  "and-any",
  "and-all",
  "not-any",
  "not-all",
]);
const LORE_INSERTION_POSITIONS = new Set<LoreInsertionPosition>([
  "before-character",
  "after-character",
  "at-depth",
]);
const LORE_ENTRY_ROLES = new Set<LoreEntryRole>([
  "system",
  "user",
  "assistant",
]);
const LORE_GENERATION_TRIGGER_TYPES = new Set<LoreGenerationTriggerType>([
  "normal",
  "continue",
  "impersonate",
  "swipe",
  "regenerate",
  "quiet",
]);

function readFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNullableNonNegativeInteger(
  value: unknown,
  fallback: number | null,
) {
  if (value === null) return null;
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function readNonNegativeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function readProbability(value: unknown) {
  const probability = readFiniteNumber(value, 100);
  return Math.min(100, Math.max(0, probability));
}

function readNullablePercent(value: unknown, fallback: number | null) {
  if (value === null) return null;
  const percent = readNullableNonNegativeInteger(value, fallback);
  return typeof percent === "number" ? Math.min(100, percent) : percent;
}

function readStringListOrNull(value: unknown) {
  const list = readStringArray(value)
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

function readNullableTrimmedString(value: unknown) {
  const text = readString(value).trim();
  return text || null;
}

function readEnumValue<T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
) {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : fallback;
}

function readNullableEnumValue<T extends string>(
  value: unknown,
  allowed: Set<T>,
) {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : null;
}

function normalizeActivationSettings(
  value: unknown,
): LorebookActivationSettings {
  const source = isRecord(value) ? value : {};
  return {
    scanDepth: readNonNegativeInteger(
      source.scanDepth,
      DEFAULT_LOREBOOK_ACTIVATION.scanDepth,
    ),
    includeNames:
      typeof source.includeNames === "boolean"
        ? source.includeNames
        : DEFAULT_LOREBOOK_ACTIVATION.includeNames,
    caseSensitiveKeys:
      typeof source.caseSensitiveKeys === "boolean"
        ? source.caseSensitiveKeys
        : DEFAULT_LOREBOOK_ACTIVATION.caseSensitiveKeys,
    matchWholeWords:
      typeof source.matchWholeWords === "boolean"
        ? source.matchWholeWords
        : DEFAULT_LOREBOOK_ACTIVATION.matchWholeWords,
    recursiveScan:
      typeof source.recursiveScan === "boolean"
        ? source.recursiveScan
        : DEFAULT_LOREBOOK_ACTIVATION.recursiveScan,
    maxRecursionSteps: readNonNegativeInteger(
      source.maxRecursionSteps,
      DEFAULT_LOREBOOK_ACTIVATION.maxRecursionSteps,
    ),
    budgetTokens: readNullableNonNegativeInteger(
      source.budgetTokens,
      DEFAULT_LOREBOOK_ACTIVATION.budgetTokens,
    ),
    budgetPercent: readNullablePercent(
      source.budgetPercent,
      DEFAULT_LOREBOOK_ACTIVATION.budgetPercent,
    ),
  };
}

function normalizeEntryRecursion(value: unknown): LoreEntryRecursion | null {
  if (!isRecord(value)) return null;
  return {
    nonRecursable:
      typeof value.nonRecursable === "boolean" ? value.nonRecursable : false,
    preventFurther:
      typeof value.preventFurther === "boolean" ? value.preventFurther : false,
    delayUntilRecursion:
      typeof value.delayUntilRecursion === "boolean"
        ? value.delayUntilRecursion
        : false,
    recursionLevel: readNonNegativeInteger(value.recursionLevel, 0),
  };
}

function normalizeEntryTiming(value: unknown): LoreEntryTiming | null {
  if (!isRecord(value)) return null;
  return {
    sticky: readNonNegativeInteger(value.sticky, 0),
    cooldown: readNonNegativeInteger(value.cooldown, 0),
    delay: readNonNegativeInteger(value.delay, 0),
  };
}

function normalizeEntryTriggers(value: unknown): LoreEntryTriggers | null {
  if (!isRecord(value)) return null;
  const triggerTypes = readStringArray(value.types).filter(
    (type): type is LoreGenerationTriggerType =>
      LORE_GENERATION_TRIGGER_TYPES.has(type as LoreGenerationTriggerType),
  );
  return {
    types: triggerTypes.length > 0 ? triggerTypes : null,
  };
}

function normalizeCharacterFilter(value: unknown): LoreCharacterFilter | null {
  if (!isRecord(value)) return null;
  return {
    mode: value.mode === "exclude" ? "exclude" : "include",
    characterIds: readStringArray(value.characterIds)
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

function normalizeMatchSources(value: unknown): LoreMatchSources | null {
  if (!isRecord(value)) return null;
  return {
    characterDescription: value.characterDescription === true,
    characterPersonality: value.characterPersonality === true,
    scenario: value.scenario === true,
    characterNote: value.characterNote === true,
    personaDescription: value.personaDescription === true,
  };
}

function normalizeLorebookEntryRecord(value: unknown): LoreEntryRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 2) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  const body = readString(value.body).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  return {
    id,
    schemaVersion: 2,
    title,
    body,
    enabled: typeof value.enabled === "boolean" ? value.enabled : true,
    key: readStringListOrNull(value.key),
    keySecondary: readStringListOrNull(value.keySecondary),
    selectiveLogic: readNullableEnumValue(
      value.selectiveLogic,
      LORE_SELECTIVE_LOGIC,
    ),
    strategy: readEnumValue(value.strategy, LORE_ENTRY_STRATEGIES, "constant"),
    probability: readProbability(value.probability),
    inclusionGroup: readNullableTrimmedString(value.inclusionGroup),
    insertionPosition: readEnumValue(
      value.insertionPosition,
      LORE_INSERTION_POSITIONS,
      "after-character",
    ),
    insertionOrder: readFiniteNumber(value.insertionOrder, 100),
    depth: readNullableNonNegativeInteger(value.depth, null),
    role: readNullableEnumValue(value.role, LORE_ENTRY_ROLES),
    recursion: normalizeEntryRecursion(value.recursion),
    timing: normalizeEntryTiming(value.timing),
    triggers: normalizeEntryTriggers(value.triggers),
    characterFilter: normalizeCharacterFilter(value.characterFilter),
    matchSources: normalizeMatchSources(value.matchSources),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function normalizeLorebookRecord(value: unknown): LorebookRecord | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 2) return null;

  const id = readString(value.id).trim();
  const title = readString(value.title).trim();
  if (!id || !title) return null;

  const now = new Date().toISOString();
  const entries = Array.isArray(value.entries)
    ? value.entries
        .map(normalizeLorebookEntryRecord)
        .filter((entry): entry is LoreEntryRecord => entry !== null)
    : [];

  return {
    id,
    schemaVersion: 2,
    title,
    summary: readString(value.summary).trim(),
    activation: normalizeActivationSettings(value.activation),
    entries,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

export function loadLorebookRecords() {
  return [];
}

const lorebookRepository = createStorageRepository({
  entity: STORAGE_ENTITIES.lorebooks,
  normalizeRecord: normalizeLorebookRecord,
  seedRecords: [],
});

export function loadLorebookRecordsFromStorage(rawUrl?: string) {
  return lorebookRepository.loadSnapshot(rawUrl);
}

export function saveLorebookRecordsToStorage(
  records: LorebookRecord[],
  rawUrl?: string,
) {
  return lorebookRepository.save(records, rawUrl);
}
