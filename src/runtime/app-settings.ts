import { MESSENGER, type SurfaceId } from "../engine/surfaces";
import {
  isProviderConnectionId,
  LOCAL_MOCK_PROVIDER_CONNECTION_ID,
  REMOTE_RUNTIME_PROVIDER_CONNECTION_ID,
  type ProviderConnectionId,
} from "../engine/provider-connection";
import { isRecord, readString } from "./catalog-storage";
import { loadHostRecordsSnapshot, saveHostRecords } from "./host-storage";
import { STORAGE_ENTITIES } from "./storage-entities";

const APP_SETTINGS_RECORD_ID = "app-settings";
const MAX_SURFACE_STATUS_LENGTH = 80;

export type AccentId = "koi" | "jade" | "amber";
export type MotionPref = "auto" | "reduced" | "off";
export type DensityPref = "comfortable" | "compact";

export interface AppSettings {
  // --- existing (unchanged) ---
  sendOnEnterSurface: SurfaceId;
  confirmRelease: boolean;
  surfaceStatus: string;
  shoalSortMode: ShoalSortMode;
  activeMessengerConnectionId: ProviderConnectionId;

  // --- behavior (promoted from ephemeral local state) ---
  streamReplies: boolean;
  rippleSpeed: number; // 0..100
  surfaceAllText: boolean;
  wheelNavigate: boolean;
  narrationDrift: number; // 0..100
  autoplayPause: number; // slider units; display value = (n / 10).toFixed(1) + 's'

  // --- appearance (new) ---
  accent: AccentId;
  motion: MotionPref;
  density: DensityPref;
  fontScale: number; // 90..120 (percent)

  // --- generation defaults (new) ---
  defaultTemperature: number; // 0..200 (store x100)
  defaultMaxTokens: number; // 64..8192
  defaultTopP: number; // 0..100 (store x100)
}

export type ShoalSortMode = "freshest" | "oldest" | "title";

type AppSettingsRecord = AppSettings & { id: typeof APP_SETTINGS_RECORD_ID };

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sendOnEnterSurface: MESSENGER,
  confirmRelease: true,
  surfaceStatus: "",
  shoalSortMode: "freshest",
  activeMessengerConnectionId: LOCAL_MOCK_PROVIDER_CONNECTION_ID,

  // --- behavior defaults ---
  streamReplies: true,
  rippleSpeed: 50,
  surfaceAllText: false,
  wheelNavigate: false,
  narrationDrift: 50,
  autoplayPause: 30,

  // --- appearance defaults ---
  accent: "koi",
  motion: "auto",
  density: "comfortable",
  fontScale: 100,

  // --- generation defaults ---
  defaultTemperature: 80,
  defaultMaxTokens: 1024,
  defaultTopP: 95,
};

function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "messenger" || value === "classic" || value === "reserved";
}

function isShoalSortMode(value: unknown): value is ShoalSortMode {
  return value === "freshest" || value === "oldest" || value === "title";
}

export function isAccentId(value: unknown): value is AccentId {
  return value === "koi" || value === "jade" || value === "amber";
}

export function isMotionPref(value: unknown): value is MotionPref {
  return value === "auto" || value === "reduced" || value === "off";
}

export function isDensityPref(value: unknown): value is DensityPref {
  return value === "comfortable" || value === "compact";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
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

    // --- behavior (promoted) ---
    streamReplies:
      typeof parsed.streamReplies === "boolean"
        ? parsed.streamReplies
        : DEFAULT_APP_SETTINGS.streamReplies,
    rippleSpeed: clampNumber(
      parsed.rippleSpeed,
      0,
      100,
      DEFAULT_APP_SETTINGS.rippleSpeed,
    ),
    surfaceAllText:
      typeof parsed.surfaceAllText === "boolean"
        ? parsed.surfaceAllText
        : DEFAULT_APP_SETTINGS.surfaceAllText,
    wheelNavigate:
      typeof parsed.wheelNavigate === "boolean"
        ? parsed.wheelNavigate
        : DEFAULT_APP_SETTINGS.wheelNavigate,
    narrationDrift: clampNumber(
      parsed.narrationDrift,
      0,
      100,
      DEFAULT_APP_SETTINGS.narrationDrift,
    ),
    autoplayPause: clampNumber(
      parsed.autoplayPause,
      0,
      100,
      DEFAULT_APP_SETTINGS.autoplayPause,
    ),

    // --- appearance (new) ---
    accent: isAccentId(parsed.accent)
      ? parsed.accent
      : DEFAULT_APP_SETTINGS.accent,
    motion: isMotionPref(parsed.motion)
      ? parsed.motion
      : DEFAULT_APP_SETTINGS.motion,
    density: isDensityPref(parsed.density)
      ? parsed.density
      : DEFAULT_APP_SETTINGS.density,
    fontScale: clampNumber(
      parsed.fontScale,
      90,
      120,
      DEFAULT_APP_SETTINGS.fontScale,
    ),

    // --- generation defaults (new) ---
    defaultTemperature: clampNumber(
      parsed.defaultTemperature,
      0,
      200,
      DEFAULT_APP_SETTINGS.defaultTemperature,
    ),
    defaultMaxTokens: clampNumber(
      parsed.defaultMaxTokens,
      64,
      8192,
      DEFAULT_APP_SETTINGS.defaultMaxTokens,
    ),
    defaultTopP: clampNumber(
      parsed.defaultTopP,
      0,
      100,
      DEFAULT_APP_SETTINGS.defaultTopP,
    ),
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
    entity: STORAGE_ENTITIES.appSettings,
    normalizeRecord: normalizeAppSettingsRecord,
    rawUrl,
    seedRecords: [appSettingsToRecord(DEFAULT_APP_SETTINGS)],
  });

  return {
    ...snapshot,
    settings: normalizeAppSettings(snapshot.records[0]),
  };
}

export function saveAppSettingsToStorage(
  settings: AppSettings,
  rawUrl?: string,
) {
  return saveHostRecords(
    STORAGE_ENTITIES.appSettings,
    [appSettingsToRecord(settings)],
    normalizeAppSettingsRecord,
    rawUrl,
  );
}
