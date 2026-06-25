import type { CharacterRecord } from "../engine/character";
import type { ClassicThread } from "../engine/classic";
import type { LorebookRecord } from "../engine/lorebook";
import type { MessengerThread } from "../engine/messenger";
import type { PersonaRecord } from "../engine/persona";
import type { ProviderConnectionRecord } from "../engine/provider-connection";
import type { RippleState } from "../engine/ripples";
import type { AppSettings } from "../engine/app-settings";
import { normalizeAppSettings } from "../engine/app-settings";
import { isRecord, normalizeCatalogList } from "./catalog-storage";
import { normalizeCharacterRecord } from "./character-storage";
import { normalizeClassicThread } from "./classic-storage";
import { normalizeLorebookRecord } from "./lorebook-storage";
import { normalizeMessengerThreads } from "./messenger-storage";
import { normalizePersonaRecord } from "./persona-storage";
import { normalizeProviderConnectionRecord } from "./provider-connection-storage";
import { normalizeRippleState } from "./ripple-state-storage";

export const DEKOI_STORAGE_BUNDLE_KIND = "dekoi.storage-bundle";
export const DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION = 1;

export interface DeKoiStorageBundleData {
  characters: CharacterRecord[];
  classicThreads: ClassicThread[];
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
  classicThreads: number;
  classicEntries: number;
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

  const normalized = normalizeCatalogList(value, normalizeRecord);
  if (normalized === null) {
    warnings.push(`${label} did not contain valid schema version 1 records.`);
    return [];
  }

  if (normalized.length !== value.length) {
    warnings.push(`${label} skipped ${value.length - normalized.length} invalid record(s).`);
  }

  return normalized;
}

export function getDeKoiStorageBundleCounts(
  data: DeKoiStorageBundleData,
): DeKoiStorageBundleCounts {
  return {
    characters: data.characters.length,
    classicThreads: data.classicThreads.length,
    classicEntries: data.classicThreads.reduce(
      (count, thread) => count + thread.entries.length,
      0,
    ),
    personas: data.personas.length,
    lorebooks: data.lorebooks.length,
    lorebookEntries: data.lorebooks.reduce(
      (count, lorebook) => count + lorebook.entries.length,
      0,
    ),
    providerConnections: data.providerConnections.length,
    messengerThreads: data.messengerThreads.length,
    messengerMessages: data.messengerThreads.reduce(
      (count, thread) => count + thread.messages.length,
      0,
    ),
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
  classicThreads,
  lorebooks,
  messengerThreads,
  personas,
  providerConnections,
  rippleStates,
}: DeKoiStorageBundleData): DeKoiStorageBundle {
  return {
    kind: DEKOI_STORAGE_BUNDLE_KIND,
    schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      appSettings: normalizeAppSettings(appSettings),
      characters: cloneRecords(characters),
      classicThreads: cloneRecords(classicThreads),
      personas: cloneRecords(personas),
      lorebooks: cloneRecords(lorebooks),
      providerConnections: cloneRecords(providerConnections),
      messengerThreads: cloneRecords(messengerThreads),
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
  const data: DeKoiStorageBundleData = {
    appSettings: normalizeAppSettings(value.data.appSettings),
    characters: normalizeList(
      value.data.characters,
      "Characters",
      normalizeCharacterRecord,
      warnings,
    ),
    classicThreads: normalizeList(
      value.data.classicThreads,
      "Classic threads",
      normalizeClassicThread,
      warnings,
    ),
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
      value.data.providerConnections,
      "Provider connections",
      normalizeProviderConnectionRecord,
      warnings,
    ),
    messengerThreads: normalizeMessengerThreads(value.data.messengerThreads),
    rippleStates: normalizeList(
      value.data.rippleStates,
      "Ripple states",
      normalizeRippleState,
      warnings,
    ),
  };

  if (!Array.isArray(value.data.messengerThreads)) {
    warnings.push("Messenger threads was missing or not an array; imported as empty.");
  } else if (data.messengerThreads.length !== value.data.messengerThreads.length) {
    warnings.push(
      `Messenger threads skipped ${value.data.messengerThreads.length - data.messengerThreads.length} invalid record(s).`,
    );
  }

  const classicThreadIds = new Set(data.classicThreads.map((thread) => thread.id));
  const messengerThreadIds = new Set(
    data.messengerThreads.map((thread) => thread.id),
  );
  const validRippleStates = data.rippleStates.filter((state) =>
    state.ownerKind === "classic-thread"
      ? classicThreadIds.has(state.ownerId)
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
