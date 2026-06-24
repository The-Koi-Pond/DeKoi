import { MESSENGER, type SurfaceId } from "../engine/surfaces";

const APP_SETTINGS_STORAGE_KEY = "dekoi:app-settings:v1";

export interface AppSettings {
  sendOnEnterSurface: SurfaceId;
  confirmRelease: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sendOnEnterSurface: MESSENGER,
  confirmRelease: true,
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "messenger" || value === "classic" || value === "reserved";
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
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  if (!hasLocalStorage()) return;

  window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
