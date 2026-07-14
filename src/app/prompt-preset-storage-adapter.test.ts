import { describe, expect, it, vi } from "vitest";

import { runPromptPresetStorageAdapter } from "./prompt-preset-storage-adapter";
import { createStorageTransactionCoordinator, type AppStorageRecords } from "../features/runtime";

const snapshot = {
  appSettings: {},
  characters: [],
  personas: [],
  lorebooks: [],
  promptPresets: [],
  loreRuntimeStates: [],
  macroVariableStates: [],
  providerConnections: [],
  roleplayThreads: [],
  messengerThreads: [],
  rippleStates: [],
} as unknown as AppStorageRecords;

describe("runPromptPresetStorageAdapter", () => {
  it("reconciles after a failed catalog transaction releases its coordinator", async () => {
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "memory://storage" },
      snapshot,
    );
    const onTransactionSettled = vi.fn();

    const result = await runPromptPresetStorageAdapter(
      {
        kind: "create",
        id: "preset-1",
        now: "2026-07-14T00:00:00.000Z",
        input: { title: "New preset", systemPrompt: "Hello" },
      },
      {
        storageReady: true,
        droppedRecordSaveBlocked: false,
        droppedRecordSaveBlockMessage: "blocked",
        coordinator,
        getLatestSnapshot: () => snapshot,
        flush: async () => ({ flushed: true, message: "" }),
        saveCollections: async () => ({ status: "error", message: "save failed" }),
        rollbackCollection: async () => ({ status: "ready", message: "" }),
        isTargetCurrent: () => true,
        mergeLoadedStorageMetadata: () => undefined,
        onSaveError: () => undefined,
        onRollbackReady: () => undefined,
        onRollbackError: () => undefined,
        onPublish: () => undefined,
        onTransactionSettled,
        refreshSaveStatus: () => undefined,
      },
    );

    expect(result).toMatchObject({ saved: false, published: false, message: "save failed" });
    expect(coordinator.hasActiveTransaction()).toBe(false);
    expect(onTransactionSettled).toHaveBeenCalledOnce();
  });
});
