import { appStorageCollectionSignature, type AppStorageRecords } from "./app-storage-workflows";
import type {
  StorageTransactionCoordinator,
  StorageTransactionTarget,
} from "./storage-transaction-coordinator";
import {
  createPromptPresetRecord,
  updatePromptPresetRecord,
  type PromptPresetInput,
} from "../../../engine/prompt-presets/prompt-preset-actions";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";

export type PromptPresetCatalogMutation =
  | { kind: "create"; id: string; now: string; input: PromptPresetInput }
  | {
      kind: "update";
      presetId: string;
      originalUpdatedAt: string;
      now: string;
      input: PromptPresetInput;
    };

export type PromptPresetCatalogTransactionResult = {
  saved: boolean;
  published: boolean;
  blocked: boolean;
  message: string;
  snapshot?: AppStorageRecords;
  preset?: PromptPresetRecord;
};

export async function runPromptPresetCatalogTransaction({
  mutation,
  coordinator,
  getLatestSnapshot,
  flush,
  saveCollection,
  publish,
  rollback,
}: {
  mutation: PromptPresetCatalogMutation;
  coordinator: StorageTransactionCoordinator;
  getLatestSnapshot: () => AppStorageRecords;
  flush: () => Promise<{ flushed: boolean; message: string }>;
  saveCollection: (
    snapshot: AppStorageRecords,
    rawUrl: string,
    target: StorageTransactionTarget,
  ) => Promise<{ status: "ready" | "error"; message: string }>;
  rollback: (
    snapshot: AppStorageRecords,
    rawUrl: string,
    target: StorageTransactionTarget,
  ) => Promise<{ status: "ready" | "error"; message: string }>;
  publish: (snapshot: AppStorageRecords) => void;
}): Promise<PromptPresetCatalogTransactionResult> {
  const flushed = await flush();
  if (!flushed.flushed)
    return { saved: false, published: false, blocked: true, message: flushed.message };
  const transaction = coordinator.tryBegin("prompt-preset-catalog-save");
  if (!transaction)
    return {
      saved: false,
      published: false,
      blocked: true,
      message: "Another storage transaction is active.",
    };

  try {
    const current = transaction.getLatestSnapshot() ?? getLatestSnapshot();
    const baselineSignature = appStorageCollectionSignature(current, "promptPresets");
    const existing = current.promptPresets.find(
      (preset) => preset.id === (mutation.kind === "update" ? mutation.presetId : ""),
    );
    let preset: PromptPresetRecord;
    if (mutation.kind === "create") {
      preset = createPromptPresetRecord({
        id: mutation.id,
        input: mutation.input,
        now: mutation.now,
      });
    } else {
      if (!existing)
        return {
          saved: false,
          published: false,
          blocked: false,
          message: "Prompt preset was not found.",
        };
      if (!mutation.originalUpdatedAt || existing.updatedAt !== mutation.originalUpdatedAt)
        return {
          saved: false,
          published: false,
          blocked: false,
          message: "Prompt preset changed elsewhere; reload and retry.",
        };
      preset = updatePromptPresetRecord(existing, mutation.input, mutation.now);
    }
    const promptPresets =
      mutation.kind === "create"
        ? [preset, ...current.promptPresets]
        : current.promptPresets.map((item) => (item.id === preset.id ? preset : item));
    const candidate = { ...current, promptPresets };
    if (
      !transaction.isTargetCurrent() ||
      appStorageCollectionSignature(transaction.getLatestSnapshot(), "promptPresets") !==
        baselineSignature
    )
      return {
        saved: false,
        published: false,
        blocked: true,
        message: "Prompt preset state changed; retry the save.",
      };
    let result: { status: "ready" | "error"; message: string };
    try {
      result = await saveCollection(candidate, transaction.target.rawUrl, transaction.target);
    } catch (error) {
      result = {
        status: "error" as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
    if (result.status === "error")
      return { saved: false, published: false, blocked: false, message: result.message, preset };
    if (
      !transaction.isTargetCurrent() ||
      appStorageCollectionSignature(transaction.getLatestSnapshot(), "promptPresets") !==
        baselineSignature
    ) {
      const restored = await rollback(
        transaction.getRollbackSnapshot(),
        transaction.target.rawUrl,
        transaction.target,
      );
      return {
        saved: false,
        published: false,
        blocked: true,
        message:
          restored.status === "ready"
            ? "Prompt preset state changed before publication; rolled back. Retry the save."
            : `Prompt preset state changed and rollback failed: ${restored.message}`,
      };
    }
    publish(candidate);
    return {
      saved: true,
      published: true,
      blocked: false,
      message: "Prompt preset saved.",
      snapshot: candidate,
      preset,
    };
  } finally {
    transaction.finish();
  }
}
