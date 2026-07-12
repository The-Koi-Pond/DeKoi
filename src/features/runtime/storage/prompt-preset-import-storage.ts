import {
  appStorageCollectionSignature,
  saveAppStorageCollections,
  type AppStorageMetadata,
  type AppStorageRecords,
  type MessengerStorageMode,
} from "./app-storage-workflows";
import { errorMessage } from "../../../shared/errors";

type PromptPresetRecord = AppStorageRecords["promptPresets"][number];
type PromptPresetCollectionSaveResult = {
  mode: MessengerStorageMode;
  status: "ready" | "error";
  message: string;
  storageMetadata: AppStorageMetadata;
};
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
