import type { DeKoiStorageBundle } from "./dekoi-storage-bundle";
import {
  exportDesktopBundleFile as exportDesktopBundleFilePayload,
  importDesktopBundleFileSnapshot,
} from "../shared/api/desktop-bundle-file";
import { asDesktopHostErrorMessage } from "../shared/api/desktop-host-common";
import {
  normalizeDesktopStorageBundleSnapshot,
  type DeKoiDesktopStorageBundleInfo,
  type DeKoiDesktopStorageBundleResult,
  type DeKoiDesktopStorageBundleSnapshot,
} from "./desktop-storage-bundle-normalizer";

export type DeKoiDesktopBundleFileImportResult =
  | Extract<DeKoiDesktopStorageBundleResult, { ok: true }>
  | { ok: false; cancelled?: boolean; error: string };

export async function exportDesktopBundleFile(
  bundle: DeKoiStorageBundle,
  defaultFileName: string,
): Promise<DeKoiDesktopStorageBundleInfo | null> {
  return await exportDesktopBundleFilePayload(bundle, defaultFileName);
}

export async function importDesktopBundleFile(): Promise<DeKoiDesktopBundleFileImportResult> {
  let snapshot: DeKoiDesktopStorageBundleSnapshot | null;
  try {
    snapshot = await importDesktopBundleFileSnapshot();
  } catch (error) {
    return { ok: false, error: asDesktopHostErrorMessage(error) };
  }

  if (!snapshot) {
    return {
      ok: false,
      cancelled: true,
      error: "Desktop file import was cancelled.",
    };
  }

  return normalizeDesktopStorageBundleSnapshot(snapshot);
}
