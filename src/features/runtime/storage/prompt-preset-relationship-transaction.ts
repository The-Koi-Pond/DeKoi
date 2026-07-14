import {
  appStorageCollectionSignature,
  APP_STORAGE_COLLECTION_KEYS,
  type AppStorageCollectionKey,
  type AppStorageRecords,
} from "./app-storage-workflows";
import type { StorageTransactionCoordinator } from "./storage-transaction-coordinator";
import {
  planPromptPresetDefault,
  planPromptPresetDeletion,
  type PromptPresetRelationshipMutation,
  type PromptPresetRelationshipTransactionResult,
  type PromptPresetRelationshipSnapshot,
} from "../../../engine/prompt-presets/prompt-preset-relationship-actions";

export type { PromptPresetRelationshipMutation };

type PersistedCollectionSignatures = Partial<Record<AppStorageCollectionKey, string>>;

type PromptPresetRelationshipStorageTransactionResult =
  PromptPresetRelationshipTransactionResult & {
    snapshot?: AppStorageRecords;
    persistedSignatures?: PersistedCollectionSignatures;
  };

export async function runPromptPresetRelationshipTransaction({
  mutation,
  coordinator,
  getLatestSnapshot,
  saveCollection,
  reload,
  publish,
}: {
  mutation: PromptPresetRelationshipMutation;
  coordinator: StorageTransactionCoordinator;
  getLatestSnapshot: () => AppStorageRecords;
  saveCollection: (
    snapshot: AppStorageRecords,
    key: AppStorageCollectionKey,
  ) => Promise<{ status: "ready" | "error"; message: string }>;
  reload: () => Promise<AppStorageRecords>;
  publish: (snapshot: AppStorageRecords, affectedKeys: readonly AppStorageCollectionKey[]) => void;
}): Promise<PromptPresetRelationshipStorageTransactionResult> {
  const transaction = coordinator.tryBegin("prompt-preset-relationship");
  if (!transaction)
    return {
      saved: false,
      published: false,
      blocked: true,
      message: "Another storage transaction is active.",
    };

  try {
    const current = transaction.getLatestSnapshot() ?? getLatestSnapshot();
    const domain: PromptPresetRelationshipSnapshot = {
      appSettings: current.appSettings,
      promptPresets: current.promptPresets,
      modeThreads: current.modeThreads,
    };
    let nextDomain: PromptPresetRelationshipSnapshot | null;
    let keys: AppStorageCollectionKey[];
    if (mutation.kind === "delete") {
      const plan = planPromptPresetDeletion(domain, mutation.presetId, mutation.updatedAt);
      if (!plan.ok) {
        return {
          saved: false,
          published: false,
          blocked: false,
          message:
            plan.reason === "default"
              ? "The default prompt preset cannot be deleted."
              : plan.reason === "invalid-default"
                ? "Prompt preset deletion is blocked because the app default is invalid."
                : plan.reason === "last-preset"
                  ? "The last prompt preset cannot be deleted."
                  : "Prompt preset was not found.",
        };
      }
      nextDomain = plan.snapshot;
      keys = [...(plan.reassignedModeThreads > 0 ? ["modeThreads" as const] : []), "promptPresets"];
    } else {
      nextDomain = planPromptPresetDefault(domain, mutation.presetId);
      if (!nextDomain)
        return {
          saved: false,
          published: false,
          blocked: false,
          message: "Prompt preset was not found.",
        };
      if (nextDomain === domain) {
        return {
          saved: false,
          published: false,
          blocked: false,
          message: "Prompt preset is already the app default.",
        };
      }
      keys = ["appSettings"];
    }

    const candidate: AppStorageRecords = { ...current, ...nextDomain };
    const persistedSignatures: PersistedCollectionSignatures = {};
    const partialPersistence = () =>
      Object.keys(persistedSignatures).length > 0 ? { persistedSignatures } : {};
    const baselineSignatures = new Map(
      keys.map((key) => [key, appStorageCollectionSignature(current, key)] as const),
    );
    const baselineAllSignatures = new Map(
      APP_STORAGE_COLLECTION_KEYS.map(
        (key) => [key, appStorageCollectionSignature(current, key)] as const,
      ),
    );
    const hasConcurrentAffectedEdit = () =>
      keys.some(
        (key) =>
          appStorageCollectionSignature(transaction.getLatestSnapshot(), key) !==
          baselineSignatures.get(key),
      );
    const hasConcurrentAnyEdit = () =>
      APP_STORAGE_COLLECTION_KEYS.some(
        (key) =>
          appStorageCollectionSignature(transaction.getLatestSnapshot(), key) !==
          baselineAllSignatures.get(key),
      );
    for (const key of keys) {
      const targetCurrent = transaction.isTargetCurrent();
      const affectedEdit = hasConcurrentAffectedEdit();
      if (!targetCurrent || affectedEdit) {
        let persisted: AppStorageRecords | undefined;
        if (!targetCurrent) {
          try {
            persisted = await reload();
          } catch {
            // The target change is still reported honestly below.
          }
        }
        return {
          saved: false,
          published: false,
          blocked: true,
          message: `${targetCurrent ? "Affected state changed; newer in-memory edits were preserved" : "Storage target changed"}; persisted storage was${persisted ? " " : " not "}reloaded. Retry the prompt preset change.`,
          snapshot: persisted,
          ...(!persisted && targetCurrent ? partialPersistence() : {}),
        };
      }
      let result: { status: "ready" | "error"; message: string };
      try {
        result = await saveCollection(candidate, key);
      } catch (error) {
        result = {
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        };
      }
      if (result.status === "error") {
        const targetCurrent = transaction.isTargetCurrent();
        const concurrentEdit = hasConcurrentAnyEdit();
        if (concurrentEdit && targetCurrent) {
          return {
            saved: false,
            published: false,
            blocked: true,
            message: `${result.message} A newer in-memory edit was preserved; persisted storage was not reloaded. Retry the prompt preset change.`,
            ...partialPersistence(),
          };
        }
        let persisted: AppStorageRecords | undefined;
        let reloadMessage = " Persisted storage was reloaded; retry the change.";
        try {
          persisted = await reload();
        } catch (error) {
          reloadMessage = ` Persisted storage reload failed (${error instanceof Error ? error.message : String(error)}); retry after storage recovers.`;
        }
        return {
          saved: false,
          published: false,
          blocked: false,
          message: `${result.message} Some changes may have been saved.${reloadMessage}`,
          snapshot: persisted,
          ...(!persisted && targetCurrent ? partialPersistence() : {}),
        };
      }
      persistedSignatures[key] = appStorageCollectionSignature(candidate, key);
    }
    const targetCurrent = transaction.isTargetCurrent();
    const affectedEdit = hasConcurrentAffectedEdit();
    if (!targetCurrent || affectedEdit) {
      let persisted: AppStorageRecords | undefined;
      if (!targetCurrent) {
        try {
          persisted = await reload();
        } catch {
          // Keep the newer in-memory state untouched and report the reload gap.
        }
      }
      return {
        saved: false,
        published: false,
        blocked: true,
        message: `${targetCurrent ? "Affected state changed; newer in-memory edits were preserved" : "Storage target changed"} before publication; persisted storage was${persisted ? " " : " not "}reloaded. Retry the prompt preset change.`,
        snapshot: persisted,
        ...(!persisted && targetCurrent ? partialPersistence() : {}),
      };
    }
    publish(candidate, keys);
    return {
      saved: true,
      published: true,
      blocked: false,
      message: "Prompt preset change saved.",
      snapshot: candidate,
    };
  } finally {
    transaction.finish();
  }
}
