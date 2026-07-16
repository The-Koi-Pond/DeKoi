import {
  appStorageCollectionSignature,
  saveAppStorageCollections,
  type AppStorageMetadata,
  type AppStorageRecords,
  type StorageMode,
} from "./app-storage-workflows";
import { errorMessage } from "../../../shared/errors";
import type { StorageTransactionCoordinator } from "./storage-transaction-coordinator";

type PromptPresetRecord = AppStorageRecords["promptPresets"][number];
type PromptPresetCollectionSaveResult = {
  mode: StorageMode;
  status: "ready" | "error";
  message: string;
  storageMetadata: AppStorageMetadata;
};
export type PromptPresetImportSaveResult = {
  mode: StorageMode;
  status: "ready" | "error";
  message: string;
  saved: boolean;
  blocked: boolean;
};

export interface PromptPresetImportStoragePorts {
  cancelQueuedSaveDispatch: () => void;
  drainSaveQueue: () => void;
  waitForActiveSaveToSettle: () => Promise<void>;
  getStorageMode: () => StorageMode;
  publishSaving: (message: string) => void;
  mergeStorageMetadata: (storageMetadata: AppStorageMetadata) => void;
  setPersistedPromptPresetSignature: (signature: string) => void;
  clearPendingPromptPresetSave: () => void;
  clearPromptPresetSaveError: () => void;
  setUnsavedPromptPresetSignature: (signature: string) => void;
  clearUnsavedPromptPresetSignature: () => void;
  refreshSaveStatus: (
    generation: number,
    result?: PromptPresetCollectionSaveResult | PromptPresetImportSaveResult,
  ) => void;
  flushFailureSaves: () => Promise<unknown>;
}
type SavePromptPresetCollection = (
  snapshot: AppStorageRecords,
  collectionKeys: ["promptPresets"],
  rawUrl: string,
) => Promise<PromptPresetCollectionSaveResult>;

export type StagedPromptPresetStorageResult = {
  saved: boolean;
  message: string;
  persisted: {
    snapshot: AppStorageRecords;
    result: PromptPresetCollectionSaveResult;
  } | null;
};

export function promptPresetPersistenceSignatures(
  persistedSnapshot: AppStorageRecords,
  currentSnapshot: AppStorageRecords,
) {
  const persistedSignature = appStorageCollectionSignature(persistedSnapshot, "promptPresets");
  const currentSignature = appStorageCollectionSignature(currentSnapshot, "promptPresets");
  return {
    persistedSignature,
    currentSignature,
    hasUnsavedChanges: currentSignature !== persistedSignature,
  };
}

interface SaveStagedPromptPresetInput {
  preset: PromptPresetRecord;
  initialSnapshot: AppStorageRecords;
  getRollbackSnapshot: () => AppStorageRecords;
  isCommitCurrent?: () => boolean;
  commitChangedMessage?: string;
  rawUrl: string;
  saveCollection?: SavePromptPresetCollection;
}

async function restorePromptPresetSnapshot({
  failureMessage,
  getRollbackSnapshot,
  rawUrl,
  saveCollection,
}: {
  failureMessage: string;
  getRollbackSnapshot: () => AppStorageRecords;
  rawUrl: string;
  saveCollection: SavePromptPresetCollection;
}): Promise<StagedPromptPresetStorageResult> {
  const rollbackSnapshot = getRollbackSnapshot();
  try {
    const rollbackResult = await saveCollection(rollbackSnapshot, ["promptPresets"], rawUrl);
    if (rollbackResult.status === "ready") {
      return {
        saved: false,
        message: failureMessage,
        persisted: { snapshot: rollbackSnapshot, result: rollbackResult },
      };
    }
    return {
      saved: false,
      message: `${failureMessage} Catalog storage rollback could not be saved. ${rollbackResult.message}`,
      persisted: null,
    };
  } catch (error) {
    return {
      saved: false,
      message: `${failureMessage} Catalog storage rollback could not be saved. ${errorMessage(error)}`,
      persisted: null,
    };
  }
}

export async function saveStagedPromptPresetToStorage({
  preset,
  initialSnapshot,
  getRollbackSnapshot,
  isCommitCurrent = () => true,
  commitChangedMessage = "Prompt preset save finished after the storage target changed.",
  rawUrl,
  saveCollection = saveAppStorageCollections,
}: SaveStagedPromptPresetInput): Promise<StagedPromptPresetStorageResult> {
  const stagedSnapshot: AppStorageRecords = {
    ...initialSnapshot,
    promptPresets: [preset, ...initialSnapshot.promptPresets],
  };

  try {
    const storageResult = await saveCollection(stagedSnapshot, ["promptPresets"], rawUrl);
    if (storageResult.status === "ready") {
      if (!isCommitCurrent()) {
        return restorePromptPresetSnapshot({
          failureMessage: commitChangedMessage,
          getRollbackSnapshot,
          rawUrl,
          saveCollection,
        });
      }
      return {
        saved: true,
        message: storageResult.message,
        persisted: { snapshot: stagedSnapshot, result: storageResult },
      };
    }
    return restorePromptPresetSnapshot({
      failureMessage: storageResult.message,
      getRollbackSnapshot,
      rawUrl,
      saveCollection,
    });
  } catch (error) {
    return restorePromptPresetSnapshot({
      failureMessage: errorMessage(error),
      getRollbackSnapshot,
      rawUrl,
      saveCollection,
    });
  }
}

export async function runPromptPresetImportStorageTransaction({
  preset,
  coordinator,
  ports,
  saveCollection,
}: {
  preset: PromptPresetRecord;
  coordinator: StorageTransactionCoordinator;
  ports: PromptPresetImportStoragePorts;
  saveCollection?: SavePromptPresetCollection;
}): Promise<PromptPresetImportSaveResult> {
  const createFailure = (message: string, blocked: boolean): PromptPresetImportSaveResult => ({
    mode: ports.getStorageMode(),
    status: "error",
    message,
    saved: false,
    blocked,
  });

  const transaction = coordinator.tryBegin("prompt-preset-import");
  if (!transaction) {
    return createFailure(
      "Prompt preset save blocked because another import is already in progress.",
      true,
    );
  }

  try {
    let result: PromptPresetImportSaveResult;

    try {
      ports.cancelQueuedSaveDispatch();
      ports.drainSaveQueue();
      await ports.waitForActiveSaveToSettle();

      if (!transaction.isTargetCurrent()) {
        result = createFailure(
          "Prompt preset save was interrupted because the storage target changed.",
          true,
        );
      } else {
        const initialSnapshot = transaction.getLatestSnapshot();
        ports.publishSaving("Saving imported prompt preset...");
        const storageTransaction = await saveStagedPromptPresetToStorage({
          preset,
          initialSnapshot,
          getRollbackSnapshot: transaction.getRollbackSnapshot,
          isCommitCurrent: transaction.isTargetCurrent,
          rawUrl: transaction.target.rawUrl,
          saveCollection,
        });

        if (!transaction.isTargetCurrent()) {
          result = createFailure(storageTransaction.message, true);
        } else {
          const persisted = storageTransaction.persisted;
          if (persisted) {
            ports.mergeStorageMetadata(persisted.result.storageMetadata);
            const { persistedSignature, currentSignature, hasUnsavedChanges } =
              promptPresetPersistenceSignatures(
                persisted.snapshot,
                transaction.getLatestSnapshot(),
              );
            ports.setPersistedPromptPresetSignature(persistedSignature);
            ports.clearPendingPromptPresetSave();
            ports.clearPromptPresetSaveError();
            if (hasUnsavedChanges) {
              ports.setUnsavedPromptPresetSignature(currentSignature);
            } else {
              ports.clearUnsavedPromptPresetSignature();
            }
          } else if (!storageTransaction.saved) {
            ports.setUnsavedPromptPresetSignature(
              appStorageCollectionSignature(transaction.getLatestSnapshot(), "promptPresets"),
            );
          }

          if (storageTransaction.saved && persisted) {
            ports.refreshSaveStatus(transaction.target.generation, persisted.result);
            result = {
              ...persisted.result,
              saved: true,
              blocked: false,
            };
          } else {
            result = createFailure(storageTransaction.message, false);
            ports.refreshSaveStatus(transaction.target.generation, result);
          }
        }
      }
    } catch (error) {
      result = createFailure(errorMessage(error), false);
      ports.refreshSaveStatus(transaction.target.generation, result);
    }

    if (!result.saved && transaction.isTargetCurrent()) {
      await ports.flushFailureSaves();
    }

    return result;
  } finally {
    transaction.finish();
  }
}
