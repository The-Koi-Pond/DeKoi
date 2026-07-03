import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";

export interface DeKoiDesktopStorageBundleInfo {
  path: string;
  byteLength: number;
  updatedAtMs: number | null;
}

export interface DeKoiDesktopStorageBundleSnapshot extends DeKoiDesktopStorageBundleInfo {
  bundle: unknown;
}

function requireTauriForDesktopStorage() {
  requireTauriForDesktopHost("Desktop host storage is only available inside the Tauri app.");
}

export async function readDesktopStorageBundleSnapshot(): Promise<DeKoiDesktopStorageBundleSnapshot | null> {
  requireTauriForDesktopStorage();

  return await invoke<DeKoiDesktopStorageBundleSnapshot | null>(DESKTOP_COMMANDS.storageReadBundle);
}

export async function writeDesktopStorageBundle(
  bundle: unknown,
): Promise<DeKoiDesktopStorageBundleInfo> {
  requireTauriForDesktopStorage();

  return await invoke<DeKoiDesktopStorageBundleInfo>(DESKTOP_COMMANDS.storageWriteBundle, {
    bundle,
  });
}
