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

function requireTauriForDesktopStorageMetadata() {
  requireTauriForDesktopHost(
    "Desktop storage metadata is only available inside the Tauri app.",
  );
}

export async function readDesktopStorageCollectionMetadata(
  entity?: string,
): Promise<DesktopStorageCollectionMetadata[]> {
  requireTauriForDesktopStorageMetadata();

  return await invoke<DesktopStorageCollectionMetadata[]>(
    DESKTOP_COMMANDS.storageCollectionMetadata,
    { entity: entity ?? null },
  );
}
