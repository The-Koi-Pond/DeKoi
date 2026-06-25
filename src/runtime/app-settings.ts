import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "../engine/app-settings";
import { isRecord, readString } from "./storage/storage-json";
import { createHostStorageRepository } from "./host-storage";
import { STORAGE_ENTITIES } from "./storage/storage-entities";

const APP_SETTINGS_RECORD_ID = "app-settings";

type AppSettingsRecord = AppSettings & { id: typeof APP_SETTINGS_RECORD_ID };
export {
  DEFAULT_APP_SETTINGS,
  isAccentId,
  isDensityPref,
  isMotionPref,
  normalizeAppSettings,
  normalizeSurfaceStatus,
  type AccentId,
  type AppSettings,
  type DensityPref,
  type MotionPref,
  type ShoalSortMode,
} from "../engine/app-settings";

function normalizeAppSettingsRecord(value: unknown): AppSettingsRecord | null {
  if (!isRecord(value)) return null;
  const id = readString(value.id, APP_SETTINGS_RECORD_ID).trim();
  if (id !== APP_SETTINGS_RECORD_ID) return null;

  return {
    id: APP_SETTINGS_RECORD_ID,
    ...normalizeAppSettings(value),
  };
}

function appSettingsToRecord(settings: AppSettings): AppSettingsRecord {
  return {
    id: APP_SETTINGS_RECORD_ID,
    ...normalizeAppSettings(settings),
  };
}

const appSettingsRepository = createHostStorageRepository({
  entity: STORAGE_ENTITIES.appSettings,
  normalizeRecord: normalizeAppSettingsRecord,
  seedRecords: [appSettingsToRecord(DEFAULT_APP_SETTINGS)],
});

export function loadAppSettings(): AppSettings {
  return DEFAULT_APP_SETTINGS;
}

export async function loadAppSettingsFromStorage(rawUrl?: string) {
  const snapshot = await appSettingsRepository.loadSnapshot(rawUrl);

  return {
    ...snapshot,
    settings: normalizeAppSettings(snapshot.records[0]),
  };
}

export function saveAppSettingsToStorage(
  settings: AppSettings,
  rawUrl?: string,
) {
  return appSettingsRepository.save([appSettingsToRecord(settings)], rawUrl);
}
