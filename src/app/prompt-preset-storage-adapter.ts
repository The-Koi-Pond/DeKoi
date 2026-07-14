import {
  type AppStorageMetadata,
  type AppStorageRecords,
  type PromptPresetCatalogMutation,
  type PromptPresetCatalogTransactionResult,
  runPromptPresetCatalogTransaction,
  type StorageTransactionCoordinator,
} from "../features/runtime";
import { errorMessage } from "../shared/errors";
import type { StorageTransactionTarget } from "../features/runtime";

export type PromptPresetStorageAdapterPorts = {
  storageReady: boolean;
  droppedRecordSaveBlocked: boolean;
  droppedRecordSaveBlockMessage: string;
  coordinator: StorageTransactionCoordinator;
  getLatestSnapshot: () => AppStorageRecords;
  flush: () => Promise<{ flushed: boolean; message: string }>;
  saveCollections: (
    snapshot: AppStorageRecords,
    target: StorageTransactionTarget,
  ) => Promise<{
    status: "ready" | "error";
    message: string;
    storageMetadata?: AppStorageMetadata;
  }>;
  rollbackCollection: (
    snapshot: AppStorageRecords,
    target: StorageTransactionTarget,
  ) => Promise<{
    status: "ready" | "error";
    message: string;
    storageMetadata?: AppStorageMetadata;
  }>;
  isTargetCurrent: (target: StorageTransactionTarget) => boolean;
  mergeLoadedStorageMetadata: (metadata: AppStorageMetadata) => void;
  onSaveError: (message: string) => void;
  onRollbackReady: (snapshot: AppStorageRecords) => void;
  onRollbackError: (message: string) => void;
  onPublish: (snapshot: AppStorageRecords) => void;
  onTransactionSettled: () => void;
  refreshSaveStatus: () => void;
};

export async function runPromptPresetStorageAdapter(
  mutation: PromptPresetCatalogMutation,
  ports: PromptPresetStorageAdapterPorts,
): Promise<PromptPresetCatalogTransactionResult> {
  if (!ports.storageReady)
    return { saved: false, published: false, blocked: true, message: "App storage is not ready." };
  if (ports.droppedRecordSaveBlocked)
    return {
      saved: false,
      published: false,
      blocked: true,
      message: ports.droppedRecordSaveBlockMessage,
    };

  const result = await runPromptPresetCatalogTransaction({
    mutation,
    coordinator: ports.coordinator,
    getLatestSnapshot: ports.getLatestSnapshot,
    flush: ports.flush,
    saveCollection: async (snapshot, _rawUrl, target) => {
      try {
        const saved = await ports.saveCollections(snapshot, target);
        if (saved.status === "ready" && saved.storageMetadata && ports.isTargetCurrent(target))
          ports.mergeLoadedStorageMetadata(saved.storageMetadata);
        if (saved.status === "error" && ports.isTargetCurrent(target))
          ports.onSaveError(saved.message);
        return saved;
      } catch (error) {
        const message = errorMessage(error, "Prompt preset save failed.");
        if (ports.isTargetCurrent(target)) ports.onSaveError(message);
        return {
          status: "error" as const,
          message,
        };
      }
    },
    rollback: async (snapshot, _rawUrl, target) => {
      try {
        const restored = await ports.rollbackCollection(snapshot, target);
        if (restored.status === "ready" && ports.isTargetCurrent(target)) {
          if (restored.storageMetadata) ports.mergeLoadedStorageMetadata(restored.storageMetadata);
          ports.onRollbackReady(snapshot);
        } else if (restored.status === "error" && ports.isTargetCurrent(target)) {
          ports.onRollbackError(`Prompt preset rollback failed: ${restored.message}`);
        }
        if (ports.isTargetCurrent(target)) ports.refreshSaveStatus();
        return restored;
      } catch (error) {
        const message = errorMessage(error, "Prompt preset rollback failed.");
        if (ports.isTargetCurrent(target)) {
          ports.onRollbackError(`Prompt preset rollback failed: ${message}`);
          ports.refreshSaveStatus();
        }
        return { status: "error" as const, message };
      }
    },
    publish: ports.onPublish,
  });
  ports.onTransactionSettled();
  if (!result.published) ports.refreshSaveStatus();
  return result;
}
