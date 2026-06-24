import { invoke } from "@tauri-apps/api/core";
import type { DeKoiStorageBundle } from "./dekoi-storage-bundle";
import {
  asDesktopHostErrorMessage,
  normalizeDesktopStorageBundleSnapshot,
  requireTauriForDesktopHost,
  type DeKoiDesktopStorageBundleInfo,
  type DeKoiDesktopStorageBundleResult,
  type DeKoiDesktopStorageBundleSnapshot,
} from "./desktop-host-common";

export type DeKoiDesktopBundleFileImportResult =
  | Extract<DeKoiDesktopStorageBundleResult, { ok: true }>
  | { ok: false; cancelled?: boolean; error: string };

export async function exportDesktopBundleFile(
  bundle: DeKoiStorageBundle,
  defaultFileName: string,
): Promise<DeKoiDesktopStorageBundleInfo | null> {
  requireTauriForDesktopHost(
    "Desktop file import/export is only available inside the Tauri app.",
  );

  return await invoke<DeKoiDesktopStorageBundleInfo | null>(
    "dekoi_file_export_bundle",
    { bundle, defaultFileName },
  );
}

export async function importDesktopBundleFile(): Promise<DeKoiDesktopBundleFileImportResult> {
  try {
    requireTauriForDesktopHost(
      "Desktop file import/export is only available inside the Tauri app.",
    );
  } catch (error) {
    return { ok: false, error: asDesktopHostErrorMessage(error) };
  }

  let snapshot: DeKoiDesktopStorageBundleSnapshot | null;
  try {
    snapshot =
      await invoke<DeKoiDesktopStorageBundleSnapshot | null>(
        "dekoi_file_import_bundle",
      );
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
