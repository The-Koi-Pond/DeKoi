import {
  normalizeDeKoiStorageBundle,
  type DeKoiStorageBundle,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
} from "./dekoi-storage-bundle";
import type {
  DeKoiDesktopStorageBundleInfo,
  DeKoiDesktopStorageBundleSnapshot,
} from "../../../shared/api/desktop-storage-bundle";
export type {
  DeKoiDesktopStorageBundleInfo,
  DeKoiDesktopStorageBundleSnapshot,
} from "../../../shared/api/desktop-storage-bundle";

export type DeKoiDesktopStorageBundleResult =
  | {
      ok: true;
      bundle: DeKoiStorageBundle;
      counts: DeKoiStorageBundleCounts;
      fingerprint: DeKoiStorageBundlePreview["fingerprint"];
      info: DeKoiDesktopStorageBundleInfo;
      warnings: string[];
    }
  | { ok: false; cancelled?: boolean; error: string };

export function normalizeDesktopStorageBundleSnapshot(
  snapshot: DeKoiDesktopStorageBundleSnapshot,
): DeKoiDesktopStorageBundleResult {
  const normalized = normalizeDeKoiStorageBundle(snapshot.bundle);
  if (!normalized.ok) return { ok: false, error: normalized.error };

  return {
    ok: true,
    bundle: normalized.preview.bundle,
    counts: normalized.preview.counts,
    fingerprint: normalized.preview.fingerprint,
    info: {
      path: snapshot.path,
      byteLength: snapshot.byteLength,
      updatedAtMs: snapshot.updatedAtMs,
    },
    warnings: normalized.preview.warnings,
  };
}
