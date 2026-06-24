import { MESSENGER, type SurfaceId } from "../engine/surfaces";
import {
  isProviderConnectionId,
  LOCAL_MOCK_PROVIDER_CONNECTION_ID,
  REMOTE_RUNTIME_PROVIDER_CONNECTION_ID,
  type ProviderConnectionId,
} from "../engine/provider-connection";
import { isRecord, readString } from "./catalog-storage";
import { loadHostRecordsSnapshot, saveHostRecords } from "./host-storage";

const APP_SETTINGS_ENTITY = "app-settings";
const APP_SETTINGS_RECORD_ID = "app-settings";
const MAX_SURFACE_STATUS_LENGTH = 80;

export interface AppSettings {
  sendOnEnterSurface: SurfaceId;
  confirmRelease: boolean;
  surfaceStatus: string;
  shoalSortMode: ShoalSortMode;
  activeMessengerConnectionId: ProviderConnectionId;
}

export type ShoalSortMode = "freshest" | "oldest" | "title";

type AppSettingsRecord = AppSettings & { id: typeof APP_SETTINGS_RECORD_ID };

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sendOnEnterSurface: MESSENGER,
  confirmRelease: true,
  surfaceStatus: "",
  shoalSortMode: "freshest",
  activeMessengerConnectionId: LOCAL_MOCK_PROVIDER_CONNECTION_ID,
};

function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "messenger" || value === "classic" || value === "reserved";
}

function isShoalSortMode(value: unknown): value is ShoalSortMode {
  return value === "freshest" || value === "oldest" || value === "title";
}

function migrateLegacyConnectionId(
  parsed: Partial<AppSettings> & { messengerGenerationMode?: unknown },
): ProviderConnectionId {
  if (isProviderConnectionId(parsed.activeMessengerConnectionId)) {
    return parsed.activeMessengerConnectionId;
  }

  if (parsed.messengerGenerationMode === "remote-runtime") {
    return REMOTE_RUNTIME_PROVIDER_CONNECTION_ID;
  }

  return DEFAULT_APP_SETTINGS.activeMessengerConnectionId;
}

export function normalizeSurfaceStatus(value: string) {
  return value.slice(0, MAX_SURFACE_STATUS_LENGTH);
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<AppSettings>)
      : {};

  return {
    sendOnEnterSurface: isSurfaceId(parsed.sendOnEnterSurface)
      ? parsed.sendOnEnterSurface
      : DEFAULT_APP_SETTINGS.sendOnEnterSurface,
    confirmRelease:
      typeof parsed.confirmRelease === "boolean"
        ? parsed.confirmRelease
        : DEFAULT_APP_SETTINGS.confirmRelease,
    surfaceStatus:
      typeof parsed.surfaceStatus === "string"
        ? normalizeSurfaceStatus(parsed.surfaceStatus)
        : DEFAULT_APP_SETTINGS.surfaceStatus,
    shoalSortMode: isShoalSortMode(parsed.shoalSortMode)
      ? parsed.shoalSortMode
      : DEFAULT_APP_SETTINGS.shoalSortMode,
    activeMessengerConnectionId: migrateLegacyConnectionId(parsed),
  };
}

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

export function loadAppSettings(): AppSettings {
  return DEFAULT_APP_SETTINGS;
}

export async function loadAppSettingsFromStorage(rawUrl?: string) {
  const snapshot = await loadHostRecordsSnapshot({
    entity: APP_SETTINGS_ENTITY,
    normalizeRecord: normalizeAppSettingsRecord,
    rawUrl,
    seedRecords: [appSettingsToRecord(DEFAULT_APP_SETTINGS)],
  });

  return {
    ...snapshot,
    settings: normalizeAppSettings(snapshot.records[0]),
  };
}

export function saveAppSettingsToStorage(settings: AppSettings, rawUrl?: string) {
  return saveHostRecords(
    APP_SETTINGS_ENTITY,
    [appSettingsToRecord(settings)],
    normalizeAppSettingsRecord,
    rawUrl,
  );
}
