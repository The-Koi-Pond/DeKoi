import { isProviderConnectionId, type ProviderConnectionId } from "./provider-connection";
import { MESSENGER, type SurfaceId } from "../constants/surfaces";

const MAX_SURFACE_STATUS_LENGTH = 80;

export type AccentId = "koi" | "jade" | "amber";
export type MotionPref = "auto" | "reduced" | "off";
export type DensityPref = "comfortable" | "compact";

export interface AppSettings {
  sendOnEnterSurface: SurfaceId;
  confirmRelease: boolean;
  surfaceStatus: string;
  shoalSortMode: ShoalSortMode;
  activeMessengerConnectionId: ProviderConnectionId;

  streamReplies: boolean;
  rippleSpeed: number;
  surfaceAllText: boolean;
  wheelNavigate: boolean;
  narrationDrift: number;
  autoplayPause: number;

  accent: AccentId;
  motion: MotionPref;
  density: DensityPref;
  fontScale: number;

  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultTopP: number;
}

export type ShoalSortMode = "freshest" | "oldest" | "title";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sendOnEnterSurface: MESSENGER,
  confirmRelease: true,
  surfaceStatus: "",
  shoalSortMode: "freshest",
  activeMessengerConnectionId: "",
  streamReplies: true,
  rippleSpeed: 50,
  surfaceAllText: false,
  wheelNavigate: false,
  narrationDrift: 50,
  autoplayPause: 30,
  accent: "koi",
  motion: "auto",
  density: "comfortable",
  fontScale: 100,
  defaultTemperature: 80,
  defaultMaxTokens: 1024,
  defaultTopP: 95,
};

function isSurfaceId(value: unknown): value is SurfaceId {
  return value === "messenger" || value === "roleplay" || value === "reserved";
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function migrateLegacyConnectionId(parsed: Partial<AppSettings>): ProviderConnectionId {
  if (isProviderConnectionId(parsed.activeMessengerConnectionId)) {
    return parsed.activeMessengerConnectionId;
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
    streamReplies:
      typeof parsed.streamReplies === "boolean"
        ? parsed.streamReplies
        : DEFAULT_APP_SETTINGS.streamReplies,
    rippleSpeed: clampNumber(parsed.rippleSpeed, 0, 100, DEFAULT_APP_SETTINGS.rippleSpeed),
    surfaceAllText:
      typeof parsed.surfaceAllText === "boolean"
        ? parsed.surfaceAllText
        : DEFAULT_APP_SETTINGS.surfaceAllText,
    wheelNavigate:
      typeof parsed.wheelNavigate === "boolean"
        ? parsed.wheelNavigate
        : DEFAULT_APP_SETTINGS.wheelNavigate,
    narrationDrift: clampNumber(parsed.narrationDrift, 0, 100, DEFAULT_APP_SETTINGS.narrationDrift),
    autoplayPause: clampNumber(parsed.autoplayPause, 0, 100, DEFAULT_APP_SETTINGS.autoplayPause),
    accent: isAccentId(parsed.accent) ? parsed.accent : DEFAULT_APP_SETTINGS.accent,
    motion: isMotionPref(parsed.motion) ? parsed.motion : DEFAULT_APP_SETTINGS.motion,
    density: isDensityPref(parsed.density) ? parsed.density : DEFAULT_APP_SETTINGS.density,
    fontScale: clampNumber(parsed.fontScale, 90, 120, DEFAULT_APP_SETTINGS.fontScale),
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
    defaultTopP: clampNumber(parsed.defaultTopP, 0, 100, DEFAULT_APP_SETTINGS.defaultTopP),
  };
}
