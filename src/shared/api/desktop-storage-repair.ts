import { invoke } from "@tauri-apps/api/core";
import { DESKTOP_COMMANDS } from "./desktop-commands";
import { requireTauriForDesktopHost } from "./desktop-host-common";

export type DesktopStorageRepairStrategy = "restore-backup" | "replace-empty";

interface DesktopStorageRepairMetadata {
  entity: string;
  exists: boolean;
  byteLength: number | null;
  updatedAtMs: number | null;
  contentHash: string | null;
}

export interface DesktopStorageRepairResult {
  ok: true;
  entity: string;
  strategy: DesktopStorageRepairStrategy;
  metadata: DesktopStorageRepairMetadata;
  message: string;
}

export interface DesktopStorageRepairFinishResult {
  ok: true;
  entity: string;
  metadata: DesktopStorageRepairMetadata;
  preRepairRemoved: boolean;
  message: string;
}

function requireTauriForDesktopStorageRepair() {
  requireTauriForDesktopHost("Desktop storage repair is only available inside the Tauri app.");
}

export async function repairDesktopStorageCollection({
  entity,
  strategy,
  confirm,
}: {
  entity: string;
  strategy: DesktopStorageRepairStrategy;
  confirm: boolean;
}): Promise<DesktopStorageRepairResult> {
  requireTauriForDesktopStorageRepair();

  return await invoke<DesktopStorageRepairResult>(DESKTOP_COMMANDS.storageRepairCollection, {
    entity,
    strategy,
    confirm,
  });
}

export async function finishDesktopStorageCollectionRepair({
  entity,
  confirm,
}: {
  entity: string;
  confirm: boolean;
}): Promise<DesktopStorageRepairFinishResult> {
  requireTauriForDesktopStorageRepair();

  return await invoke<DesktopStorageRepairFinishResult>(
    DESKTOP_COMMANDS.storageFinishCollectionRepair,
    { entity, confirm },
  );
}
