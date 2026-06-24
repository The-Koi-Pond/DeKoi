import { isTauri } from "@tauri-apps/api/core";
import {
  normalizeDeKoiStorageBundle,
  type DeKoiStorageBundle,
} from "./dekoi-storage-bundle";

export interface DeKoiDesktopStorageBundleInfo {
  path: string;
  byteLength: number;
  updatedAtMs: number | null;
}

export interface DeKoiDesktopStorageBundleSnapshot
  extends DeKoiDesktopStorageBundleInfo {
  bundle: unknown;
}

export type DeKoiDesktopStorageBundleResult =
  | {
      ok: true;
      bundle: DeKoiStorageBundle;
      info: DeKoiDesktopStorageBundleInfo;
      warnings: string[];
    }
  | { ok: false; cancelled?: boolean; error: string };

export function asDesktopHostErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function requireTauriForDesktopHost(message: string) {
  if (!isTauri()) throw new Error(message);
}

export function normalizeDesktopStorageBundleSnapshot(
  snapshot: DeKoiDesktopStorageBundleSnapshot,
): DeKoiDesktopStorageBundleResult {
  const normalized = normalizeDeKoiStorageBundle(snapshot.bundle);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  return {
    ok: true,
    bundle: normalized.preview.bundle,
    info: {
      path: snapshot.path,
      byteLength: snapshot.byteLength,
      updatedAtMs: snapshot.updatedAtMs,
    },
    warnings: normalized.preview.warnings,
  };
}
