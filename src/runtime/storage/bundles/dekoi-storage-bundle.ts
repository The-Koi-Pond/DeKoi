import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { ModeMessage, ModeThread } from "../../../engine/contracts/types/mode-thread";
import {
  projectModeThreadCollections,
  type ModeThreadStorageRecord,
} from "../app-storage-collection-projection";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
} from "../../../engine/contracts/types/provider-connection";
import type { RippleState } from "../../../engine/contracts/types/ripples";
import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import { normalizeAppSettings } from "../../../engine/contracts/types/app-settings";
import { isRecord, normalizeStorageRecordList } from "../storage-json";
import { normalizeCharacterRecord } from "../collections/character-storage";
import { normalizeLorebookRecord } from "../collections/lorebook-storage";
import { normalizeLoreRuntimeState } from "../collections/lore-runtime-state-storage";
import { normalizeMacroVariableScope } from "../collections/macro-variable-state-storage";
import {
  normalizeModeThreadRecord,
  normalizeModeThreadRecordWithChange,
} from "../collections/mode-thread-storage";
import { normalizeModeMessageRecord } from "../collections/mode-message-storage";
import { normalizePersonaRecord } from "../collections/persona-storage";
import { normalizeProviderConnectionRecord } from "../collections/provider-connection-storage";
import { normalizeRippleState } from "../collections/ripple-state-storage";
import { normalizePromptPresetImportRecord } from "../../../engine/prompt-presets/prompt-preset-package";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";
import { repairPromptPresetRelationships } from "../prompt-preset-relationship-repair";
import {
  getDuplicateModeBranchIds,
  getDuplicateModeThreadIds,
} from "../../../engine/modes/mode-thread/mode-thread-validation";

export const DEKOI_STORAGE_BUNDLE_KIND = "dekoi.storage-bundle";
const DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION = 2;

interface DeKoiStorageBundleData {
  characters: CharacterRecord[];
  modeThreads: ModeThreadStorageRecord[];
  modeMessages: ModeMessage[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets: PromptPresetRecord[];
  loreRuntimeStates: LoreRuntimeState[];
  macroVariableStates: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  rippleStates: RippleState[];
  appSettings: AppSettings;
}

export interface DeKoiStorageBundleSourceData {
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets: PromptPresetRecord[];
  loreRuntimeStates: LoreRuntimeState[];
  macroVariableStates: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  modeThreads: ModeThread[];
  rippleStates: RippleState[];
  appSettings: AppSettings;
}

export interface DeKoiStorageBundle {
  kind: typeof DEKOI_STORAGE_BUNDLE_KIND;
  schemaVersion: typeof DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION;
  exportedAt: string;
  data: DeKoiStorageBundleData;
}

export interface DeKoiStorageBundleCounts {
  characters: number;
  modeThreads: number;
  personas: number;
  lorebooks: number;
  promptPresets: number;
  lorebookEntries: number;
  loreRuntimeStates: number;
  loreRuntimeEntries: number;
  macroVariableStates: number;
  macroVariables: number;
  providerConnections: number;
  modeThreadKinds: { messenger: number; roleplay: number };
  modeMessages: number;
  rippleStates: number;
  ripples: number;
}

export interface DeKoiStorageBundlePreview {
  bundle: DeKoiStorageBundle;
  counts: DeKoiStorageBundleCounts;
  warnings: string[];
  fingerprint: string;
}

export type DeKoiStorageBundleParseResult =
  { ok: true; preview: DeKoiStorageBundlePreview } | { ok: false; error: string };

function cloneRecords<T>(records: T[]): T[] {
  return records.map((record) => ({ ...record }));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
}

function fnv1a32(input: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

export function createDeKoiStorageBundleFingerprint(
  bundle: DeKoiStorageBundle,
  includedData?: unknown,
): string {
  return fnv1a32(
    stableStringify({
      kind: bundle.kind,
      schemaVersion: bundle.schemaVersion,
      data: bundle.data,
      includedData,
    }),
  );
}

const PROVIDER_CONNECTION_SECRET_FIELDS = [
  "apiKey",
  "api_key",
  "providerKey",
  "providerSecret",
  "secret",
] as const;

function redactProviderConnectionSecrets(
  records: ProviderConnectionRecord[],
): ProviderConnectionRecord[] {
  return records.map((record) => {
    const sanitized = sanitizeProviderConnectionRecord(record);
    const providerOption = getProviderConnectionProviderOption(sanitized.provider);

    return {
      id: sanitized.id,
      schemaVersion: 1,
      kind: sanitized.kind,
      provider: sanitized.provider,
      label: sanitized.label,
      baseUrl: sanitized.baseUrl,
      model: sanitized.model,
      summary: sanitized.summary,
      status: providerOption.apiKeyRequired ? "needs-key" : sanitized.status,
      modelLabel: sanitized.modelLabel,
      agentDefault: sanitized.agentDefault,
      maxContext: sanitized.maxContext,
      maxOutput: sanitized.maxOutput,
      createdAt: sanitized.createdAt,
      updatedAt: sanitized.updatedAt,
    };
  });
}

function hasProviderConnectionSecretField(value: unknown) {
  if (!isRecord(value)) return false;

  return PROVIDER_CONNECTION_SECRET_FIELDS.some((field) => field in value);
}

function normalizeList<T extends { id: string }>(
  value: unknown,
  label: string,
  normalizeRecord: (value: unknown) => T | null,
  warnings: string[],
  expectedSchemaVersion = 1,
) {
  if (!Array.isArray(value)) {
    warnings.push(`${label} was missing or not an array; imported as empty.`);
    return [];
  }

  const normalized = normalizeStorageRecordList(value, normalizeRecord);
  if (normalized === null) {
    warnings.push(
      `${label} did not contain valid schema version ${expectedSchemaVersion} records.`,
    );
    return [];
  }

  if (normalized.length !== value.length) {
    warnings.push(`${label} skipped ${value.length - normalized.length} invalid record(s).`);
  }

  return normalized;
}

function normalizeOptionalList<T extends { id: string }>(
  value: unknown,
  label: string,
  normalizeRecord: (value: unknown) => T | null,
  warnings: string[],
) {
  if (value === undefined) return [];
  return normalizeList(value, label, normalizeRecord, warnings);
}

export function getDeKoiStorageBundleCounts(
  data: DeKoiStorageBundleData | DeKoiStorageBundleSourceData,
): DeKoiStorageBundleCounts {
  const modeMessages =
    "modeMessages" in data
      ? data.modeMessages.length
      : data.modeThreads.reduce((count, thread) => count + thread.messages.length, 0);
  const modeThreads = data.modeThreads;

  return {
    characters: data.characters.length,
    modeThreads: modeThreads.length,
    modeMessages,
    personas: data.personas.length,
    lorebooks: data.lorebooks.length,
    promptPresets: data.promptPresets.length,
    lorebookEntries: data.lorebooks.reduce((count, lorebook) => count + lorebook.entries.length, 0),
    loreRuntimeStates: data.loreRuntimeStates.length,
    loreRuntimeEntries: data.loreRuntimeStates.reduce(
      (count, state) => count + state.entries.length,
      0,
    ),
    macroVariableStates: data.macroVariableStates.length,
    macroVariables: data.macroVariableStates.reduce(
      (count, state) => count + Object.keys(state.variables).length,
      0,
    ),
    providerConnections: data.providerConnections.length,
    modeThreadKinds: {
      messenger: modeThreads.filter((thread) => thread.kind === "messenger").length,
      roleplay: modeThreads.filter((thread) => thread.kind === "roleplay").length,
    },
    rippleStates: data.rippleStates.length,
    ripples: data.rippleStates.reduce((count, state) => count + state.ripples.length, 0),
  };
}

export function createDeKoiStorageBundle({
  appSettings,
  characters,
  modeThreads,
  lorebooks,
  promptPresets,
  loreRuntimeStates,
  macroVariableStates,
  personas,
  providerConnections,
  rippleStates,
}: DeKoiStorageBundleSourceData): DeKoiStorageBundle {
  return {
    kind: DEKOI_STORAGE_BUNDLE_KIND,
    schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      appSettings: normalizeAppSettings(appSettings),
      characters: cloneRecords(characters),
      ...projectModeThreadCollections(modeThreads),
      personas: cloneRecords(personas),
      lorebooks: cloneRecords(lorebooks),
      promptPresets: cloneRecords(promptPresets),
      loreRuntimeStates: cloneRecords(loreRuntimeStates),
      macroVariableStates: cloneRecords(macroVariableStates),
      providerConnections: redactProviderConnectionSecrets(providerConnections),
      rippleStates: cloneRecords(rippleStates),
    },
  };
}

export function normalizeDeKoiStorageBundle(value: unknown): DeKoiStorageBundleParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Bundle must be a JSON object." };
  }

  if (value.kind !== DEKOI_STORAGE_BUNDLE_KIND) {
    return { ok: false, error: "Bundle kind is not a DeKoi storage bundle." };
  }

  if (value.schemaVersion !== DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION) {
    return { ok: false, error: "Bundle schema version is not supported." };
  }

  if (!isRecord(value.data)) {
    return { ok: false, error: "Bundle data is missing." };
  }

  if (!Array.isArray(value.data.modeMessages)) {
    return { ok: false, error: "Bundle mode messages are missing or invalid." };
  }

  const warnings: string[] = [];
  const rawProviderConnections = value.data.providerConnections;
  const providerConnectionSecretFieldCount = Array.isArray(rawProviderConnections)
    ? rawProviderConnections.filter(hasProviderConnectionSecretField).length
    : 0;
  const normalizedModeThreads = normalizeList(
    value.data.modeThreads,
    "Mode threads",
    normalizeModeThreadRecord,
    warnings,
  );
  const normalizedModeThreadCandidates = Array.isArray(value.data.modeThreads)
    ? value.data.modeThreads
        .map(normalizeModeThreadRecord)
        .filter((thread): thread is ModeThreadStorageRecord => thread !== null)
    : [];
  const duplicateThreadId = getDuplicateModeThreadIds(normalizedModeThreadCandidates)[0];
  if (duplicateThreadId) {
    return {
      ok: false,
      error: `Mode thread ID ${duplicateThreadId} is duplicated.`,
    };
  }
  const normalizedHistoryChangeCount = Array.isArray(value.data.modeThreads)
    ? value.data.modeThreads.reduce(
        (count, rawThread) =>
          count + (normalizeModeThreadRecordWithChange(rawThread)?.changed ? 1 : 0),
        0,
      )
    : 0;
  const threadIds = new Set(normalizedModeThreads.map((thread) => thread.id));
  const duplicateBranchId = getDuplicateModeBranchIds(normalizedModeThreads)[0];
  if (duplicateBranchId) {
    return {
      ok: false,
      error: `Mode branch ID ${duplicateBranchId} is duplicated across threads.`,
    };
  }
  const branchOwners = new Map(
    normalizedModeThreads.flatMap((thread) =>
      thread.branches.map((branch) => [branch.id, thread.id] as const),
    ),
  );
  const parsedModeMessages = normalizeList(
    value.data.modeMessages,
    "Mode messages",
    normalizeModeMessageRecord,
    warnings,
  );
  const normalizedModeMessages = parsedModeMessages.filter(
    (message) =>
      threadIds.has(message.threadId) && branchOwners.get(message.branchId) === message.threadId,
  );
  if (normalizedModeMessages.length !== parsedModeMessages.length) {
    warnings.push(
      `Mode messages skipped ${parsedModeMessages.length - normalizedModeMessages.length} orphan or mismatched record(s).`,
    );
  }
  const normalizedAppSettings = normalizeAppSettings(value.data.appSettings);
  const importedPromptPresets = normalizeOptionalList(
    value.data.promptPresets,
    "Prompt presets",
    normalizePromptPresetImportRecord,
    warnings,
  );
  const normalizedPromptPresets =
    importedPromptPresets.length > 0 ? importedPromptPresets : [STARTER_PROMPT_PRESET];
  const repairedDefaultPromptPresetId =
    normalizedPromptPresets.find(
      (preset) => preset.id === normalizedAppSettings.defaultPromptPresetId,
    )?.id ??
    normalizedPromptPresets[0]?.id ??
    null;
  const defaultWasRepaired =
    repairedDefaultPromptPresetId !== normalizedAppSettings.defaultPromptPresetId;
  let repairedModeThreadCount = 0;
  let clearedModePresetReferenceCount = 0;
  let repairedModeChoiceSelectionCount = 0;
  const repairedModeThreads = normalizedModeThreads.map((thread) => {
    const repaired = repairPromptPresetRelationships<(typeof thread.branches)[number]>(
      thread.branches,
      normalizedPromptPresets,
      new Set(),
      repairedDefaultPromptPresetId,
    );
    if (repaired.clearedPresetReferenceCount > 0 || repaired.repairedChoiceSelectionCount > 0) {
      repairedModeThreadCount += 1;
      clearedModePresetReferenceCount += repaired.clearedPresetReferenceCount;
      repairedModeChoiceSelectionCount += repaired.repairedChoiceSelectionCount;
      return { ...thread, branches: repaired.records } as ModeThread;
    }
    return thread;
  });
  const data: DeKoiStorageBundleData = {
    appSettings: {
      ...normalizedAppSettings,
      defaultPromptPresetId: repairedDefaultPromptPresetId,
    },
    characters: normalizeList(
      value.data.characters,
      "Characters",
      normalizeCharacterRecord,
      warnings,
    ),
    modeThreads: repairedModeThreads,
    modeMessages: normalizedModeMessages,
    personas: normalizeList(value.data.personas, "Personas", normalizePersonaRecord, warnings),
    lorebooks: normalizeList(
      value.data.lorebooks,
      "Lorebooks",
      normalizeLorebookRecord,
      warnings,
      2,
    ),
    promptPresets: normalizedPromptPresets,
    loreRuntimeStates: normalizeOptionalList(
      value.data.loreRuntimeStates,
      "Lore runtime states",
      normalizeLoreRuntimeState,
      warnings,
    ),
    macroVariableStates: normalizeOptionalList(
      value.data.macroVariableStates,
      "Macro variable states",
      normalizeMacroVariableScope,
      warnings,
    ),
    providerConnections: normalizeList(
      rawProviderConnections,
      "Provider connections",
      normalizeProviderConnectionRecord,
      warnings,
    ),
    rippleStates: normalizeList(
      value.data.rippleStates,
      "Ripple states",
      normalizeRippleState,
      warnings,
    ),
  };

  if (defaultWasRepaired) {
    warnings.push("App settings repaired the default prompt preset reference.");
  }
  if (repairedModeThreadCount > 0) {
    if (clearedModePresetReferenceCount > 0) {
      warnings.push(
        `Mode threads reassigned ${clearedModePresetReferenceCount} dangling preset reference(s) to the imported default.`,
      );
    }
    if (repairedModeChoiceSelectionCount > 0) {
      warnings.push(
        `Mode threads pruned stale preset choice selections from ${repairedModeChoiceSelectionCount} branch(es).`,
      );
    }
  }
  if (normalizedHistoryChangeCount > 0) {
    warnings.push(
      `Mode threads normalized prompt preset histories in ${normalizedHistoryChangeCount} thread(s).`,
    );
  }
  if (importedPromptPresets.length === 0) {
    warnings.push("Prompt presets was empty; restored the bundled starter preset.");
  }

  if (providerConnectionSecretFieldCount > 0) {
    warnings.push(
      `Provider connections skipped secret field(s) from ${providerConnectionSecretFieldCount} imported record(s).`,
    );
  }

  const modeThreadIds = new Set(data.modeThreads.map((thread) => thread.id));
  const modeBranchIds = new Set(
    data.modeThreads.flatMap((thread) => thread.branches.map((branch) => branch.id)),
  );
  const validRippleStates = data.rippleStates.filter((state) =>
    state.ownerKind === "mode-branch"
      ? modeBranchIds.has(state.ownerId)
      : modeThreadIds.has(state.ownerId),
  );
  if (validRippleStates.length !== data.rippleStates.length) {
    warnings.push(
      `Ripple states skipped ${data.rippleStates.length - validRippleStates.length} record(s) without an imported owner.`,
    );
    data.rippleStates = validRippleStates;
  }

  const validLoreRuntimeStates = data.loreRuntimeStates.filter((state) =>
    state.ownerKind === "mode-branch"
      ? modeBranchIds.has(state.ownerId)
      : modeThreadIds.has(state.ownerId),
  );
  if (validLoreRuntimeStates.length !== data.loreRuntimeStates.length) {
    warnings.push(
      `Lore runtime states skipped ${data.loreRuntimeStates.length - validLoreRuntimeStates.length} record(s) without an imported owner.`,
    );
    data.loreRuntimeStates = validLoreRuntimeStates;
  }

  const validMacroVariableStates = data.macroVariableStates.filter((state) => {
    if (state.ownerKind === "global") return true;
    return state.ownerKind === "mode-branch"
      ? modeBranchIds.has(state.ownerId)
      : state.ownerKind === "global";
  });
  if (validMacroVariableStates.length !== data.macroVariableStates.length) {
    warnings.push(
      `Macro variable states skipped ${data.macroVariableStates.length - validMacroVariableStates.length} record(s) without an imported owner.`,
    );
    data.macroVariableStates = validMacroVariableStates;
  }

  const bundle: DeKoiStorageBundle = {
    kind: DEKOI_STORAGE_BUNDLE_KIND,
    schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
    exportedAt:
      typeof value.exportedAt === "string" && !Number.isNaN(Date.parse(value.exportedAt))
        ? value.exportedAt
        : new Date().toISOString(),
    data,
  };

  return {
    ok: true,
    preview: {
      bundle,
      counts: getDeKoiStorageBundleCounts(data),
      warnings,
      fingerprint: createDeKoiStorageBundleFingerprint(bundle),
    },
  };
}
