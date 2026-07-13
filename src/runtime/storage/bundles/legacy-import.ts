import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerMessage,
  type MessengerMessageAuthor,
  type MessengerMessageOrigin,
  type MessengerThread,
  type MessengerThreadMode,
} from "../../../engine/contracts/types/messenger";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import {
  getProviderConnectionProviderOption,
  normalizeProviderConnectionProvider,
  type ProviderConnectionKind,
  type ProviderConnectionProvider,
  type ProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import { normalizeCharacterRecord } from "../collections/character-storage";
import { normalizePersonaRecord } from "../collections/persona-storage";
import { normalizeProviderConnectionRecord } from "../collections/provider-connection-storage";
import {
  isRecord,
  readNullableString,
  readString,
  readStringArray,
  readTimestamp,
} from "../storage-json";

const LEGACY_BUBBLE_THREADS_STORAGE_KEY = "dekoi:bubble-threads:v1";
const LEGACY_BUBBLE_THREAD_STORAGE_KEY = "dekoi:bubble-thread:first-pond";
const LEGACY_MESSENGER_THREADS_STORAGE_KEY = "dekoi:messenger-threads:v1";

export interface DeKoiLegacyImportData {
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  /** Native macro variable scopes converted from legacy global and thread variables. */
  macroVariableStates: MacroVariableScope[];
  /**
   * Positional Messenger thread variable pairing used while imported thread IDs
   * are remapped. Entries align with `messengerThreads`; null means the source
   * thread had no convertible variables.
   */
  messengerThreadMacroVariableStates: (MacroVariableScope | null)[];
  providerConnections: ProviderConnectionRecord[];
  messengerThreads: MessengerThread[];
  sourceLabel: string;
}

interface DeKoiLegacyImportCounts {
  characters: number;
  personas: number;
  /** Number of imported MacroVariableScope records. */
  macroVariableStates: number;
  /** Total variable keys across imported macro variable scopes. */
  macroVariables: number;
  providerConnections: number;
  messengerThreads: number;
  messengerMessages: number;
}

export interface DeKoiLegacyImportPreview {
  data: DeKoiLegacyImportData;
  counts: DeKoiLegacyImportCounts;
  warnings: string[];
}

export type DeKoiLegacyImportParseResult =
  { ok: true; preview: DeKoiLegacyImportPreview } | { ok: false; error: string };

type LegacyImportCandidates = {
  characters: unknown[];
  personas: unknown[];
  globalVariableSources: LegacyVariableSource[];
  providerConnections: unknown[];
  messengerThreads: unknown[];
};

type LegacyVariableSource = {
  variables: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};

type LegacyThreadImport = {
  thread: MessengerThread;
  macroVariableStates: MacroVariableScope[];
};

const LEGACY_TOP_LEVEL_CANDIDATE_KEYS = [
  "characters",
  "personas",
  "providerConnections",
] as const satisfies readonly (keyof Omit<LegacyImportCandidates, "messengerThreads">)[];

function createLegacyImportCandidates(): LegacyImportCandidates {
  return {
    characters: [],
    personas: [],
    globalVariableSources: [],
    providerConnections: [],
    messengerThreads: [],
  };
}

function readLegacyVariableValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  if (value === null) return "";
  return null;
}

function normalizeLegacyVariables(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};

  const variables: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim();
    const variableValue = readLegacyVariableValue(rawValue);
    if (!name || variableValue === null) continue;
    variables[name] = variableValue;
  }
  return variables;
}

function hasLegacyVariables(value: unknown) {
  return Object.keys(normalizeLegacyVariables(value)).length > 0;
}

function addGlobalVariableSource(candidates: LegacyImportCandidates, value: unknown): boolean {
  if (!isRecord(value) || !hasLegacyVariables(value.globalVariables)) return false;

  candidates.globalVariableSources.push({
    variables: value.globalVariables,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
  return true;
}

function migrateLegacyId(id: string) {
  return id
    .replace(/^bubble-thread/, "messenger-thread")
    .replace(/^bubble-message/, "messenger-message");
}

function migrateLegacyTitle(title: string) {
  return title.replace(/^New Bubble\b/, "New Messenger");
}

function normalizeOrigin(value: unknown): MessengerMessageOrigin {
  if (
    value === "manual" ||
    value === "generated" ||
    value === "imported" ||
    value === "placeholder" ||
    value === "sample"
  ) {
    return value;
  }

  return "imported";
}

function normalizeMode(value: unknown, characterIds: string[]): MessengerThreadMode {
  if (value === "direct" || value === "group") return value;
  return characterIds.length > 1 ? "group" : "direct";
}

function normalizeLegacyCharacter(value: unknown, index: number): CharacterRecord | null {
  if (!isRecord(value)) return null;

  const now = new Date().toISOString();
  const id = readString(value.id).trim() || `character-imported-${index + 1}`;
  const displayName =
    readString(value.displayName).trim() ||
    readString(value.name).trim() ||
    `Imported Companion ${index + 1}`;
  const personality = readString(value.personality).trim() || readString(value.summary).trim();

  return normalizeCharacterRecord({
    ...value,
    id,
    schemaVersion: 1,
    displayName,
    nickname: readNullableString(value.nickname) ?? readNullableString(value.shortName),
    personality,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  });
}

function normalizeLegacyPersona(value: unknown, index: number): PersonaRecord | null {
  if (!isRecord(value)) return null;

  const now = new Date().toISOString();
  const id = readString(value.id).trim() || `persona-imported-${index + 1}`;
  const displayName =
    readString(value.displayName).trim() ||
    readString(value.name).trim() ||
    `Imported Persona ${index + 1}`;
  const personality = readString(value.personality).trim() || readString(value.summary).trim();

  return normalizePersonaRecord({
    ...value,
    id,
    schemaVersion: 1,
    displayName,
    personality,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  });
}

function normalizeLegacyProviderLabel(label: string, providerLabel: string) {
  const cleanLabel = label.trim();
  if (/^local mock$/i.test(cleanLabel)) return "Local";
  if (/^remote runtime$/i.test(cleanLabel)) return "OpenAI";
  return cleanLabel || providerLabel;
}

function normalizeLegacyProviderSummary(summary: string, label: string) {
  if (label === "OpenAI" && summary.includes("configured runtime")) {
    return "OpenAI-compatible chat completion provider.";
  }
  return summary;
}

function normalizeLegacyProviderModel(model: string) {
  const cleanModel = model.trim();
  return /^mock adapter$/i.test(cleanModel) ? "" : cleanModel;
}

function isLegacyLocalMockProviderConnection(value: Record<string, unknown>) {
  const label = readString(value.label).trim() || readString(value.name).trim();
  const model = readString(value.model).trim() || readString(value.modelLabel).trim();
  return value.kind === "mock" && /^local mock$/i.test(label) && /^mock adapter$/i.test(model);
}

function normalizeLegacyProviderKind(
  value: Record<string, unknown>,
): ProviderConnectionKind | null {
  if (value.kind === "remote-runtime" || value.kind === "provider") return "provider";
  if (isLegacyLocalMockProviderConnection(value)) return "provider";
  return null;
}

function normalizeLegacyProviderProvider(
  value: Record<string, unknown>,
): ProviderConnectionProvider {
  if (isLegacyLocalMockProviderConnection(value)) return "custom";
  return normalizeProviderConnectionProvider(value.provider, "openai");
}

function normalizeLegacyProviderConnection(
  value: unknown,
  index: number,
): ProviderConnectionRecord | null {
  if (!isRecord(value)) return null;
  const kind = normalizeLegacyProviderKind(value);
  if (!kind) return null;

  const now = new Date().toISOString();
  const provider = normalizeLegacyProviderProvider(value);
  const providerOption = getProviderConnectionProviderOption(provider);
  const id = readString(value.id).trim() || `connection-imported-${index + 1}`;
  const label = normalizeLegacyProviderLabel(
    readString(value.label).trim() || readString(value.name).trim(),
    providerOption.label,
  );
  const baseUrl = readString(value.baseUrl).trim() || readString(value.url).trim();
  const model = normalizeLegacyProviderModel(
    readString(value.model).trim() || readString(value.modelLabel).trim(),
  );
  const modelLabel = normalizeLegacyProviderModel(readString(value.modelLabel).trim()) || null;
  const summary = normalizeLegacyProviderSummary(readString(value.summary).trim(), label);

  return normalizeProviderConnectionRecord({
    ...value,
    id,
    schemaVersion: 1,
    kind,
    provider,
    label,
    baseUrl,
    model,
    modelLabel,
    summary,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  });
}

function normalizeAuthor(value: unknown): MessengerMessageAuthor {
  if (!isRecord(value)) {
    return { kind: "unknown", label: "Imported" };
  }

  const label = readString(value.label).trim() || readString(value.name).trim() || "Imported";

  if (value.kind === "persona") {
    return {
      kind: "persona",
      personaId: readString(value.personaId).trim() || "legacy-persona",
      label,
    };
  }

  if (value.kind === "character") {
    return {
      kind: "character",
      characterId: readString(value.characterId).trim() || "legacy-character",
      label,
    };
  }

  if (value.kind === "system") {
    return { kind: "system", label };
  }

  return { kind: "unknown", label };
}

function normalizeLegacyMessage(
  value: unknown,
  threadId: string,
  index: number,
): MessengerMessage | null {
  if (!isRecord(value)) return null;

  const body = readString(value.body).trim();
  if (!body) return null;

  const now = new Date().toISOString();
  const id =
    migrateLegacyId(readString(value.id).trim()) || `${threadId}-imported-message-${index + 1}`;

  return {
    id,
    schemaVersion: 1,
    threadId,
    author: normalizeAuthor(value.author),
    body,
    origin: normalizeOrigin(value.origin),
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
}

function normalizeLegacyThread(value: unknown, index: number): LegacyThreadImport | null {
  if (!isRecord(value)) return null;

  const sourceKind = value.kind;
  if (sourceKind !== "bubbles" && sourceKind !== "messenger") return null;

  const now = new Date().toISOString();
  const id =
    migrateLegacyId(readString(value.id).trim()) || `messenger-thread-imported-${index + 1}`;
  const title =
    migrateLegacyTitle(readString(value.title).trim()) || `Imported Messenger ${index + 1}`;
  const characterIds = readStringArray(value.characterIds);
  const messages = Array.isArray(value.messages)
    ? value.messages
        .map((message, messageIndex) => normalizeLegacyMessage(message, id, messageIndex))
        .filter((message): message is MessengerMessage => message !== null)
    : [];

  const thread: MessengerThread = {
    id,
    schemaVersion: 1,
    kind: "messenger",
    mode: normalizeMode(value.mode, characterIds),
    title,
    characterIds,
    activePersonaId: readNullableString(value.activePersonaId),
    lorebookIds: readStringArray(value.lorebookIds),
    presetId: readNullableString(value.presetId),
    presetChoiceSelectionsByPresetId: {},
    providerConnectionId: readNullableString(value.providerConnectionId),
    systemPromptMode: "default",
    systemPrompt: DEFAULT_MESSENGER_SYSTEM_PROMPT,
    messages,
    createdAt: readTimestamp(value.createdAt, now),
    updatedAt: readTimestamp(value.updatedAt, now),
  };
  const variables = normalizeLegacyVariables(value.variables);
  const macroVariableStates: MacroVariableScope[] =
    Object.keys(variables).length === 0
      ? []
      : [
          {
            id: `macro-variable-state-imported-thread-${index + 1}`,
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: thread.id,
            variables,
            createdAt: thread.createdAt,
            updatedAt: thread.updatedAt,
          },
        ];

  return {
    thread,
    macroVariableStates,
  };
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function collectCandidates(value: unknown) {
  const parsed = parseMaybeJson(value);
  const candidates = createLegacyImportCandidates();
  let sourceLabel = "Legacy thread JSON";

  if (Array.isArray(parsed)) {
    candidates.messengerThreads.push(...parsed);
    for (const item of parsed) {
      addGlobalVariableSource(candidates, item);
    }
    return { candidates, sourceLabel };
  }

  if (!isRecord(parsed)) {
    return { candidates, sourceLabel };
  }

  if (parsed.kind === "bubbles" || parsed.kind === "messenger") {
    candidates.messengerThreads.push(parsed);
    addGlobalVariableSource(candidates, parsed);
    return { candidates, sourceLabel };
  }

  if (addGlobalVariableSource(candidates, parsed)) {
    sourceLabel = "Legacy chat variables JSON";
  }

  if (Array.isArray(parsed.threads)) {
    candidates.messengerThreads.push(...parsed.threads);
    for (const thread of parsed.threads) {
      addGlobalVariableSource(candidates, thread);
    }
    sourceLabel = "Legacy DeKoi export";
  }

  if (Array.isArray(parsed.messengerThreads)) {
    candidates.messengerThreads.push(...parsed.messengerThreads);
    for (const thread of parsed.messengerThreads) {
      addGlobalVariableSource(candidates, thread);
    }
    sourceLabel = "Legacy DeKoi export";
  }

  for (const key of LEGACY_TOP_LEVEL_CANDIDATE_KEYS) {
    const records = parsed[key];
    if (Array.isArray(records)) {
      candidates[key].push(...records);
      sourceLabel = "Legacy DeKoi export";
    }
  }

  const storageRecord = isRecord(parsed.localStorage) ? parsed.localStorage : parsed;
  const legacyThreadList = parseMaybeJson(storageRecord[LEGACY_BUBBLE_THREADS_STORAGE_KEY]);
  const legacySingleThread = parseMaybeJson(storageRecord[LEGACY_BUBBLE_THREAD_STORAGE_KEY]);
  const messengerThreadList = parseMaybeJson(storageRecord[LEGACY_MESSENGER_THREADS_STORAGE_KEY]);

  if (Array.isArray(legacyThreadList)) {
    candidates.messengerThreads.push(...legacyThreadList);
    for (const thread of legacyThreadList) {
      addGlobalVariableSource(candidates, thread);
    }
    sourceLabel = "Legacy Bubbles export";
  }

  if (isRecord(legacySingleThread)) {
    candidates.messengerThreads.push(legacySingleThread);
    addGlobalVariableSource(candidates, legacySingleThread);
    sourceLabel = "Legacy Bubbles export";
  }

  if (Array.isArray(messengerThreadList)) {
    candidates.messengerThreads.push(...messengerThreadList);
    for (const thread of messengerThreadList) {
      addGlobalVariableSource(candidates, thread);
    }
    sourceLabel =
      sourceLabel === "Legacy Bubbles export" ? "Legacy Bubbles export" : "Legacy Messenger export";
  }

  return { candidates, sourceLabel };
}

function countCandidates(candidates: LegacyImportCandidates) {
  return (
    candidates.characters.length +
    candidates.personas.length +
    candidates.globalVariableSources.length +
    candidates.providerConnections.length +
    candidates.messengerThreads.length
  );
}

function convertCollection<T>(
  candidates: unknown[],
  normalize: (value: unknown, index: number) => T | null,
  noun: string,
  warnings: string[],
): T[] {
  const records = candidates.map(normalize).filter((record): record is T => record !== null);
  const skipped = candidates.length - records.length;
  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} unsupported legacy ${noun} record(s).`);
  }
  return records;
}

function convertThreadImports(candidates: unknown[], warnings: string[]): LegacyThreadImport[] {
  const records = candidates
    .map((candidate, index) => normalizeLegacyThread(candidate, index))
    .filter((record): record is LegacyThreadImport => record !== null);
  const skipped = candidates.length - records.length;
  if (skipped > 0) {
    warnings.push(`Skipped ${skipped} unsupported legacy thread record(s).`);
  }
  return records;
}

function mergeLegacyGlobalVariables(
  sources: readonly LegacyVariableSource[],
): Record<string, string> {
  return sources.reduce(
    (variables, source) => ({
      ...variables,
      ...normalizeLegacyVariables(source.variables),
    }),
    {} as Record<string, string>,
  );
}

function normalizeLegacyGlobalVariableState(
  sources: readonly LegacyVariableSource[],
): MacroVariableScope | null {
  const variables = mergeLegacyGlobalVariables(sources);
  let createdAt: string | null = null;
  let updatedAt: string | null = null;

  for (const source of sources) {
    const fallback = updatedAt ?? createdAt ?? new Date().toISOString();
    createdAt ??= readTimestamp(source.createdAt, fallback);
    updatedAt = readTimestamp(source.updatedAt, fallback);
  }

  if (Object.keys(variables).length === 0) return null;

  const now = new Date().toISOString();
  return {
    id: "macro-variable-state-imported-global",
    schemaVersion: 1,
    ownerKind: "global",
    ownerId: "global",
    variables,
    createdAt: createdAt ?? now,
    updatedAt: updatedAt ?? createdAt ?? now,
  };
}

function getLegacyImportCounts(data: DeKoiLegacyImportData): DeKoiLegacyImportCounts {
  return {
    characters: data.characters.length,
    personas: data.personas.length,
    macroVariableStates: data.macroVariableStates.length,
    macroVariables: data.macroVariableStates.reduce(
      (count, state) => count + Object.keys(state.variables).length,
      0,
    ),
    providerConnections: data.providerConnections.length,
    messengerThreads: data.messengerThreads.length,
    messengerMessages: data.messengerThreads.reduce(
      (count, thread) => count + thread.messages.length,
      0,
    ),
  };
}

export function normalizeLegacyImport(value: unknown): DeKoiLegacyImportParseResult {
  const { candidates, sourceLabel } = collectCandidates(value);
  if (countCandidates(candidates) === 0) {
    return {
      ok: false,
      error: "No supported legacy records were found.",
    };
  }

  const warnings: string[] = [];
  const importedThreadRecords = convertThreadImports(candidates.messengerThreads, warnings);
  const importedThreads = importedThreadRecords.map((record) => record.thread);
  const importedThreadMacroVariableStates = importedThreadRecords.map(
    (record) => record.macroVariableStates[0] ?? null,
  );
  const importedMacroVariableStates = importedThreadMacroVariableStates.filter(
    (state): state is MacroVariableScope => state !== null,
  );
  const importedGlobalMacroVariableState = normalizeLegacyGlobalVariableState(
    candidates.globalVariableSources,
  );
  if (importedGlobalMacroVariableState) {
    importedMacroVariableStates.unshift(importedGlobalMacroVariableState);
  }
  const importedCharacters = convertCollection(
    candidates.characters,
    normalizeLegacyCharacter,
    "character",
    warnings,
  );
  const importedPersonas = convertCollection(
    candidates.personas,
    normalizeLegacyPersona,
    "persona",
    warnings,
  );
  const importedProviderConnections = convertCollection(
    candidates.providerConnections,
    normalizeLegacyProviderConnection,
    "provider connection",
    warnings,
  );

  if (
    importedThreads.length +
      importedCharacters.length +
      importedPersonas.length +
      importedMacroVariableStates.length +
      importedProviderConnections.length ===
    0
  ) {
    return {
      ok: false,
      error: "Legacy records were found, but none could be converted.",
    };
  }

  const data: DeKoiLegacyImportData = {
    characters: importedCharacters,
    personas: importedPersonas,
    macroVariableStates: importedMacroVariableStates,
    messengerThreadMacroVariableStates: importedThreadMacroVariableStates,
    providerConnections: importedProviderConnections,
    messengerThreads: importedThreads,
    sourceLabel,
  };

  return {
    ok: true,
    preview: {
      data,
      counts: getLegacyImportCounts(data),
      warnings,
    },
  };
}
