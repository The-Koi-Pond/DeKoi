import type { CharacterRecord } from "../../../engine/character";
import {
  attachRoleplayEntriesToThreads,
  extractRoleplayEntries,
  toRoleplayThreadRecord,
  type RoleplayEntry,
  type RoleplayThread,
  type RoleplayThreadRecord,
} from "../../../engine/roleplay";
import type { LorebookRecord } from "../../../engine/lorebook";
import {
  attachMessengerMessagesToThreads,
  extractMessengerMessages,
  toMessengerThreadRecord,
  type MessengerMessage,
  type MessengerThread,
  type MessengerThreadRecord,
} from "../../../engine/messenger";
import type { PersonaRecord } from "../../../engine/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import {
  getProviderConnectionProviderOption,
  sanitizeProviderConnectionRecord,
} from "../../../engine/provider-connection";
import type { RippleState } from "../../../engine/ripples";
import type { AppSettings } from "../../../engine/app-settings";
import { normalizeAppSettings } from "../../../engine/app-settings";
import { isRecord, normalizeStorageRecordList } from "../storage-json";
import { normalizeCharacterRecord } from "../collections/character-storage";
import { normalizeRoleplayThread } from "../collections/roleplay-storage";
import { normalizeRoleplayEntryRecord } from "../collections/roleplay-storage";
import { normalizeLorebookRecord } from "../collections/lorebook-storage";
import { normalizeMessengerThreads } from "../collections/messenger-storage";
import { normalizeMessengerMessageRecord } from "../collections/messenger-storage";
import { normalizePersonaRecord } from "../collections/persona-storage";
import { normalizeProviderConnectionRecord } from "../collections/provider-connection-storage";
import { normalizeRippleState } from "../collections/ripple-state-storage";

export const DEKOI_STORAGE_BUNDLE_KIND = "dekoi.storage-bundle";
export const DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION = 1;

export interface DeKoiStorageBundleData {
  characters: CharacterRecord[];
  roleplayThreads: RoleplayThreadRecord[];
  roleplayEntries: RoleplayEntry[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  messengerThreads: MessengerThreadRecord[];
  messengerMessages: MessengerMessage[];
  rippleStates: RippleState[];
  appSettings: AppSettings;
}

export interface DeKoiStorageBundleSourceData {
  characters: CharacterRecord[];
  roleplayThreads: RoleplayThread[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  messengerThreads: MessengerThread[];
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
  roleplayThreads: number;
  roleplayEntries: number;
  personas: number;
  lorebooks: number;
  lorebookEntries: number;
  providerConnections: number;
  messengerThreads: number;
  messengerMessages: number;
  rippleStates: number;
  ripples: number;
}

export interface DeKoiStorageBundlePreview {
  bundle: DeKoiStorageBundle;
  counts: DeKoiStorageBundleCounts;
  warnings: string[];
}

export type DeKoiStorageBundleParseResult =
  | { ok: true; preview: DeKoiStorageBundlePreview }
  | { ok: false; error: string };

function cloneRecords<T>(records: T[]): T[] {
  return records.map((record) => ({ ...record }));
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
      keeperDefault: sanitized.keeperDefault,
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
) {
  if (!Array.isArray(value)) {
    warnings.push(`${label} was missing or not an array; imported as empty.`);
    return [];
  }

  const normalized = normalizeStorageRecordList(value, normalizeRecord);
  if (normalized === null) {
    warnings.push(`${label} did not contain valid schema version 1 records.`);
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

function filterTranscriptRowsForImportedThreads<T extends { threadId: string }>(
  records: T[],
  importedThreadIds: ReadonlySet<string>,
  label: string,
  warnings: string[],
) {
  const validRecords = records.filter((record) =>
    importedThreadIds.has(record.threadId),
  );
  if (validRecords.length !== records.length) {
    warnings.push(
      `${label} skipped ${records.length - validRecords.length} record(s) without an imported thread.`,
    );
  }
  return validRecords;
}

function mergeBundleTranscriptRows<T extends { id: string }>(
  embeddedRows: readonly T[],
  storedRows: readonly T[],
) {
  if (storedRows.length === 0) return [...embeddedRows];

  const storedRowIds = new Set(storedRows.map((row) => row.id));
  const embeddedOnlyRows = embeddedRows.filter(
    (row) => !storedRowIds.has(row.id),
  );

  return [...embeddedOnlyRows, ...storedRows];
}

export function getDeKoiStorageBundleCounts(
  data: DeKoiStorageBundleData | DeKoiStorageBundleSourceData,
): DeKoiStorageBundleCounts {
  const roleplayEntryCount =
    "roleplayEntries" in data
      ? data.roleplayEntries.length
      : data.roleplayThreads.reduce(
          (count, thread) => count + thread.entries.length,
          0,
        );
  const messengerMessageCount =
    "messengerMessages" in data
      ? data.messengerMessages.length
      : data.messengerThreads.reduce(
          (count, thread) => count + thread.messages.length,
          0,
        );

  return {
    characters: data.characters.length,
    roleplayThreads: data.roleplayThreads.length,
    roleplayEntries: roleplayEntryCount,
    personas: data.personas.length,
    lorebooks: data.lorebooks.length,
    lorebookEntries: data.lorebooks.reduce(
      (count, lorebook) => count + lorebook.entries.length,
      0,
    ),
    providerConnections: data.providerConnections.length,
    messengerThreads: data.messengerThreads.length,
    messengerMessages: messengerMessageCount,
    rippleStates: data.rippleStates.length,
    ripples: data.rippleStates.reduce(
      (count, state) => count + state.ripples.length,
      0,
    ),
  };
}

export function createDeKoiStorageBundle({
  appSettings,
  characters,
  roleplayThreads,
  lorebooks,
  messengerThreads,
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
      roleplayThreads: roleplayThreads.map(toRoleplayThreadRecord),
      roleplayEntries: extractRoleplayEntries(roleplayThreads),
      personas: cloneRecords(personas),
      lorebooks: cloneRecords(lorebooks),
      providerConnections: redactProviderConnectionSecrets(providerConnections),
      messengerThreads: messengerThreads.map(toMessengerThreadRecord),
      messengerMessages: extractMessengerMessages(messengerThreads),
      rippleStates: cloneRecords(rippleStates),
    },
  };
}

export function normalizeDeKoiStorageBundle(
  value: unknown,
): DeKoiStorageBundleParseResult {
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

  const warnings: string[] = [];
  const rawProviderConnections = value.data.providerConnections;
  const providerConnectionSecretFieldCount = Array.isArray(rawProviderConnections)
    ? rawProviderConnections.filter(hasProviderConnectionSecretField).length
    : 0;
  const normalizedRoleplayThreads = normalizeList(
    value.data.roleplayThreads,
    "Roleplay threads",
    normalizeRoleplayThread,
    warnings,
  );
  const finalRoleplayThreadRecords = normalizedRoleplayThreads.map(
    toRoleplayThreadRecord,
  );
  const normalizedRoleplayEntries = normalizeOptionalList(
    value.data.roleplayEntries,
    "Roleplay entries",
    normalizeRoleplayEntryRecord,
    warnings,
  );
  const roleplayThreadIdSet = new Set(
    finalRoleplayThreadRecords.map((thread) => thread.id),
  );
  const validRoleplaySplitEntries = filterTranscriptRowsForImportedThreads(
    normalizedRoleplayEntries,
    roleplayThreadIdSet,
    "Roleplay entries",
    warnings,
  );
  const validRoleplayEntries = mergeBundleTranscriptRows(
    extractRoleplayEntries(normalizedRoleplayThreads),
    validRoleplaySplitEntries,
  );
  const roleplayThreadsWithEntries = attachRoleplayEntriesToThreads(
    finalRoleplayThreadRecords,
    validRoleplayEntries,
  );
  const normalizedMessengerThreads = normalizeMessengerThreads(
    value.data.messengerThreads,
  );
  const finalMessengerThreadRecords = normalizedMessengerThreads.map(
    toMessengerThreadRecord,
  );
  const normalizedMessengerMessages = normalizeOptionalList(
    value.data.messengerMessages,
    "Messenger messages",
    normalizeMessengerMessageRecord,
    warnings,
  );
  const messengerThreadIdSet = new Set(
    finalMessengerThreadRecords.map((thread) => thread.id),
  );
  const validMessengerSplitMessages = filterTranscriptRowsForImportedThreads(
    normalizedMessengerMessages,
    messengerThreadIdSet,
    "Messenger messages",
    warnings,
  );
  const validMessengerMessages = mergeBundleTranscriptRows(
    extractMessengerMessages(normalizedMessengerThreads),
    validMessengerSplitMessages,
  );
  const messengerThreadsWithMessages = attachMessengerMessagesToThreads(
    finalMessengerThreadRecords,
    validMessengerMessages,
  );
  const data: DeKoiStorageBundleData = {
    appSettings: normalizeAppSettings(value.data.appSettings),
    characters: normalizeList(
      value.data.characters,
      "Characters",
      normalizeCharacterRecord,
      warnings,
    ),
    roleplayThreads: finalRoleplayThreadRecords,
    roleplayEntries: extractRoleplayEntries(roleplayThreadsWithEntries),
    personas: normalizeList(
      value.data.personas,
      "Personas",
      normalizePersonaRecord,
      warnings,
    ),
    lorebooks: normalizeList(
      value.data.lorebooks,
      "Lorebooks",
      normalizeLorebookRecord,
      warnings,
    ),
    providerConnections: normalizeList(
      rawProviderConnections,
      "Provider connections",
      normalizeProviderConnectionRecord,
      warnings,
    ),
    messengerThreads: finalMessengerThreadRecords,
    messengerMessages: extractMessengerMessages(messengerThreadsWithMessages),
    rippleStates: normalizeList(
      value.data.rippleStates,
      "Ripple states",
      normalizeRippleState,
      warnings,
    ),
  };

  if (providerConnectionSecretFieldCount > 0) {
    warnings.push(
      `Provider connections skipped secret field(s) from ${providerConnectionSecretFieldCount} imported record(s).`,
    );
  }

  if (!Array.isArray(value.data.messengerThreads)) {
    warnings.push("Messenger threads was missing or not an array; imported as empty.");
  } else if (data.messengerThreads.length !== value.data.messengerThreads.length) {
    warnings.push(
      `Messenger threads skipped ${value.data.messengerThreads.length - data.messengerThreads.length} invalid record(s).`,
    );
  }

  const roleplayThreadIds = new Set(data.roleplayThreads.map((thread) => thread.id));
  const messengerThreadIds = new Set(
    data.messengerThreads.map((thread) => thread.id),
  );
  const validRippleStates = data.rippleStates.filter((state) =>
    state.ownerKind === "roleplay-thread"
      ? roleplayThreadIds.has(state.ownerId)
      : messengerThreadIds.has(state.ownerId),
  );
  if (validRippleStates.length !== data.rippleStates.length) {
    warnings.push(
      `Ripple states skipped ${data.rippleStates.length - validRippleStates.length} record(s) without an imported owner.`,
    );
    data.rippleStates = validRippleStates;
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
    },
  };
}
