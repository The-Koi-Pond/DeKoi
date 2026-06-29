import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";

export interface DesktopStorageCollectionMetadata {
  entity: string;
  exists: boolean;
  byteLength: number | null;
  updatedAtMs: number | null;
  contentHash: string | null;
}

export interface DesktopStorageCollectionMetadataResult {
  entity: string;
  metadata: DesktopStorageCollectionMetadata | null;
  error: string | null;
  backupExists: boolean;
  backupRestorable: boolean;
  temporaryExists: boolean;
  preRepairExists: boolean;
  repairable: boolean;
}

function requireTauriForDesktopStorageMetadata() {
  requireTauriForDesktopHost(
    "Desktop storage metadata is only available inside the Tauri app.",
  );
}

export async function readDesktopStorageCollectionMetadata(
  entity?: string,
): Promise<DesktopStorageCollectionMetadataResult[]> {
  requireTauriForDesktopStorageMetadata();

  return await invoke<DesktopStorageCollectionMetadataResult[]>(
    DESKTOP_COMMANDS.storageCollectionMetadata,
    { entity: entity ?? null },
  );
}
