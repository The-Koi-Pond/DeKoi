import { MESSENGER, type SurfaceId } from "../engine/surfaces";
import {
  isMessengerGenerationRuntimeMode,
  type MessengerGenerationRuntimeMode,
} from "./messenger-generation";

const APP_SETTINGS_STORAGE_KEY = "dekoi:app-settings:v1";
const MAX_SURFACE_STATUS_LENGTH = 80;

export interface AppSettings {
  sendOnEnterSurface: SurfaceId;
  confirmRelease: boolean;
  surfaceStatus: string;
  shoalSortMode: ShoalSortMode;
  messengerGenerationMode: MessengerGenerationRuntimeMode;
}

export type ShoalSortMode = "freshest" | "oldest" | "title";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sendOnEnterSurface: MESSENGER,
  confirmRelease: true,
  surfaceStatus: "",
  shoalSortMode: "freshest",
  messengerGenerationMode: "mock",
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "messenger" || value === "classic" || value === "reserved";
}

function isShoalSortMode(value: unknown): value is ShoalSortMode {
  return value === "freshest" || value === "oldest" || value === "title";
}

export function normalizeSurfaceStatus(value: string) {
  return value.slice(0, MAX_SURFACE_STATUS_LENGTH);
}

export function loadAppSettings(): AppSettings {
  if (!hasLocalStorage()) return DEFAULT_APP_SETTINGS;

  const storedSettings = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
  if (!storedSettings) return DEFAULT_APP_SETTINGS;

  try {
    const parsed = JSON.parse(storedSettings) as Partial<AppSettings>;
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
      messengerGenerationMode: isMessengerGenerationRuntimeMode(
        parsed.messengerGenerationMode,
      )
        ? parsed.messengerGenerationMode
        : DEFAULT_APP_SETTINGS.messengerGenerationMode,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (!hasLocalStorage()) return;

  window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
