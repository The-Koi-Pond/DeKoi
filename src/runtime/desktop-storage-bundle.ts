import { invoke } from "@tauri-apps/api/core";
import type { DeKoiStorageBundle } from "./dekoi-storage-bundle";
import { DESKTOP_COMMANDS } from "../shared/api/desktop-commands";
import {
  asDesktopHostErrorMessage,
  normalizeDesktopStorageBundleSnapshot,
  requireTauriForDesktopHost,
  type DeKoiDesktopStorageBundleInfo,
  type DeKoiDesktopStorageBundleResult,
  type DeKoiDesktopStorageBundleSnapshot,
} from "./desktop-host-common";

export type DeKoiDesktopStorageReadResult =
  | Extract<DeKoiDesktopStorageBundleResult, { ok: true }>
  | { ok: false; error: string };

export async function readDesktopStorageBundle(): Promise<DeKoiDesktopStorageReadResult> {
  try {
    requireTauriForDesktopHost(
      "Desktop host storage is only available inside the Tauri app.",
    );
  } catch (error) {
    return { ok: false, error: asDesktopHostErrorMessage(error) };
  }

  let snapshot: DeKoiDesktopStorageBundleSnapshot | null;
  try {
    snapshot =
      await invoke<DeKoiDesktopStorageBundleSnapshot | null>(
        DESKTOP_COMMANDS.storageReadBundle,
      );
  } catch (error) {
    return { ok: false, error: asDesktopHostErrorMessage(error) };
  }

  if (!snapshot) {
    return { ok: false, error: "No desktop host bundle has been saved yet." };
  }

  return normalizeDesktopStorageBundleSnapshot(snapshot);
}

export async function writeDesktopStorageBundle(
  bundle: DeKoiStorageBundle,
): Promise<DeKoiDesktopStorageBundleInfo> {
  requireTauriForDesktopHost(
    "Desktop host storage is only available inside the Tauri app.",
  );

  return await invoke<DeKoiDesktopStorageBundleInfo>(
    DESKTOP_COMMANDS.storageWriteBundle,
    { bundle },
  );
}
