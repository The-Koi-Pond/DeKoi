import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";
import type {
  DeKoiDesktopStorageBundleInfo,
  DeKoiDesktopStorageBundleSnapshot,
} from "./desktop-storage-bundle";

function requireTauriForDesktopBundleFile() {
  requireTauriForDesktopHost(
    "Desktop file import/export is only available inside the Tauri app.",
  );
}

export async function exportDesktopBundleFile(
  bundle: unknown,
  defaultFileName: string,
): Promise<DeKoiDesktopStorageBundleInfo | null> {
  requireTauriForDesktopBundleFile();

  return await invoke<DeKoiDesktopStorageBundleInfo | null>(
    DESKTOP_COMMANDS.fileExportBundle,
    { bundle, defaultFileName },
  );
}

export async function importDesktopBundleFileSnapshot(): Promise<
  DeKoiDesktopStorageBundleSnapshot | null
> {
  requireTauriForDesktopBundleFile();

  return await invoke<DeKoiDesktopStorageBundleSnapshot | null>(
    DESKTOP_COMMANDS.fileImportBundle,
  );
}
