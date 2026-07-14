import { describe, expect, it, vi } from "vitest";

import type { AppStorageRecords } from "./app-storage-workflows";
import {
  promptPresetPersistenceSignatures,
  runPromptPresetImportStorageTransaction,
  saveStagedPromptPresetToStorage,
  type PromptPresetImportStoragePorts,
} from "./prompt-preset-import-storage";
import { createStorageTransactionCoordinator } from "./storage-transaction-coordinator";

const now = "2026-07-11T00:00:00.000Z";
type PromptPresetRecord = AppStorageRecords["promptPresets"][number];

function promptPreset(id: string): PromptPresetRecord {
  return {
    id,
    schemaVersion: 1,
    title: id,
    summary: null,
    systemPrompt: "Write the next response.",
    messengerPrompt: null,
    sampling: null,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    wrapFormat: null,
    author: null,
    folderId: null,
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

function appStorageRecords(promptPresets: PromptPresetRecord[]): AppStorageRecords {
  return {
    appSettings: {} as AppStorageRecords["appSettings"],
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets,
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    modeThreads: [],
    rippleStates: [],
  };
}

function storageResult(status: "ready" | "error", message: string) {
  return {
    mode: "desktop" as const,
    status,
    message,
    storageMetadata: {},
  };
}

describe("saveStagedPromptPresetToStorage", () => {
  it("keeps edits that land while a staged snapshot is being persisted dirty", () => {
    const persisted = appStorageRecords([promptPreset("prompt-preset-existing")]);
    const current = appStorageRecords([
      { ...persisted.promptPresets[0]!, title: "Edited during import" },
    ]);

    expect(promptPresetPersistenceSignatures(persisted, current)).toMatchObject({
      hasUnsavedChanges: true,
    });
    expect(promptPresetPersistenceSignatures(current, current)).toMatchObject({
      hasUnsavedChanges: false,
    });
  });

  it("persists the staged preset without changing the live snapshot", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const importedPreset = promptPreset("prompt-preset-imported");
    const liveSnapshot = appStorageRecords([existingPreset]);
    const saveCollection = vi.fn().mockResolvedValue(storageResult("ready", "Saved."));

    const result = await saveStagedPromptPresetToStorage({
      preset: importedPreset,
      initialSnapshot: liveSnapshot,
      getRollbackSnapshot: () => liveSnapshot,
      rawUrl: "",
      saveCollection,
    });

    expect(saveCollection).toHaveBeenCalledTimes(1);
    expect(saveCollection.mock.calls[0]?.[0].promptPresets).toEqual([
      importedPreset,
      existingPreset,
    ]);
    expect(liveSnapshot.promptPresets).toEqual([existingPreset]);
    expect(result.saved).toBe(true);
  });

  it("force-restores the live catalog when a committed write reports an error", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const editedPreset = { ...existingPreset, title: "Edited during import" };
    const importedPreset = promptPreset("prompt-preset-imported");
    const liveSnapshot = appStorageRecords([existingPreset]);
    let persistedPromptPresets: PromptPresetRecord[] = [];
    const saveCollection = vi.fn(async (snapshot: AppStorageRecords) => {
      persistedPromptPresets = structuredClone(snapshot.promptPresets);
      if (saveCollection.mock.calls.length === 1) {
        liveSnapshot.promptPresets = [editedPreset];
        return storageResult("error", "Cleanup failed after install.");
      }
      return storageResult("ready", "Rollback saved.");
    });

    const result = await saveStagedPromptPresetToStorage({
      preset: importedPreset,
      initialSnapshot: liveSnapshot,
      getRollbackSnapshot: () => liveSnapshot,
      rawUrl: "",
      saveCollection,
    });

    expect(saveCollection).toHaveBeenCalledTimes(2);
    expect(saveCollection.mock.calls[0]?.[0].promptPresets).toEqual([
      importedPreset,
      existingPreset,
    ]);
    expect(saveCollection.mock.calls[1]?.[0].promptPresets).toEqual([editedPreset]);
    expect(persistedPromptPresets).toEqual([editedPreset]);
    expect(result).toMatchObject({
      saved: false,
      message: "Cleanup failed after install.",
      persisted: { snapshot: liveSnapshot },
    });
  });

  it("restores the latest original-target edits when the target changes", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const editedPreset = { ...existingPreset, title: "Edited during import" };
    const importedPreset = promptPreset("prompt-preset-imported");
    const initialSnapshot = appStorageRecords([existingPreset]);
    const rollbackSnapshot = appStorageRecords([editedPreset]);
    const saveCollection = vi.fn().mockResolvedValue(storageResult("ready", "Saved."));

    const result = await saveStagedPromptPresetToStorage({
      preset: importedPreset,
      initialSnapshot,
      getRollbackSnapshot: () => rollbackSnapshot,
      isCommitCurrent: () => false,
      rawUrl: "http://old-runtime.test",
      saveCollection,
    });

    expect(saveCollection).toHaveBeenCalledTimes(2);
    expect(saveCollection.mock.calls[0]?.[0].promptPresets).toEqual([
      importedPreset,
      existingPreset,
    ]);
    expect(saveCollection.mock.calls[1]?.[0].promptPresets).toEqual([editedPreset]);
    expect(result).toMatchObject({
      saved: false,
      message: "Prompt preset save finished after the storage target changed.",
      persisted: { snapshot: rollbackSnapshot },
    });
  });

  it("reports an unconfirmed rollback without publishing success", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const liveSnapshot = appStorageRecords([existingPreset]);
    const saveCollection = vi
      .fn()
      .mockResolvedValueOnce(storageResult("error", "Staged save failed."))
      .mockResolvedValueOnce(storageResult("error", "Rollback save failed."));

    const result = await saveStagedPromptPresetToStorage({
      preset: promptPreset("prompt-preset-imported"),
      initialSnapshot: liveSnapshot,
      getRollbackSnapshot: () => liveSnapshot,
      rawUrl: "",
      saveCollection,
    });

    expect(saveCollection).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      saved: false,
      message:
        "Staged save failed. Catalog storage rollback could not be saved. Rollback save failed.",
      persisted: null,
    });
  });
});

function transactionHarness(initialSnapshot: AppStorageRecords) {
  let currentSnapshot = initialSnapshot;
  let currentTarget = { generation: 7, rawUrl: "http://runtime.test" };
  const coordinator = createStorageTransactionCoordinator(currentTarget, initialSnapshot);
  let competingTransaction: ReturnType<typeof coordinator.tryBegin> = null;
  let persistedSignature: string | null = null;
  let unsavedSignature: string | null = null;
  const events: string[] = [];

  const ports: PromptPresetImportStoragePorts = {
    cancelQueuedSaveDispatch: () => events.push("cancel"),
    drainSaveQueue: () => events.push("drain"),
    waitForActiveSaveToSettle: async () => {
      events.push("wait");
    },
    getStorageMode: () => "desktop",
    publishSaving: () => events.push("saving"),
    mergeStorageMetadata: () => events.push("metadata"),
    setPersistedPromptPresetSignature: (signature) => {
      events.push("persisted-signature");
      persistedSignature = signature;
    },
    clearPendingPromptPresetSave: () => events.push("clear-pending"),
    clearPromptPresetSaveError: () => events.push("clear-error"),
    setUnsavedPromptPresetSignature: (signature) => {
      events.push("set-unsaved");
      unsavedSignature = signature;
    },
    clearUnsavedPromptPresetSignature: () => {
      events.push("clear-unsaved");
      unsavedSignature = null;
    },
    refreshSaveStatus: () => events.push("status"),
    flushFailureSaves: async () => {
      events.push("flush");
    },
  };

  return {
    events,
    coordinator,
    ports,
    get locked() {
      return coordinator.hasActiveTransaction();
    },
    set locked(value: boolean) {
      if (value) {
        competingTransaction = coordinator.tryBegin("bundle-import");
      } else {
        competingTransaction?.finish();
        competingTransaction = null;
      }
    },
    set currentSnapshot(value: AppStorageRecords) {
      currentSnapshot = value;
      coordinator.publishCurrentState(currentTarget, value);
    },
    set rollbackSnapshot(value: AppStorageRecords) {
      currentSnapshot = value;
      coordinator.publishCurrentState(currentTarget, value);
    },
    set targetCurrent(value: boolean) {
      if (value) return;
      currentTarget = { generation: 8, rawUrl: "http://other-runtime.test" };
      coordinator.publishCurrentState(currentTarget, currentSnapshot);
    },
    get persistedSignature() {
      return persistedSignature;
    },
    get unsavedSignature() {
      return unsavedSignature;
    },
  };
}

describe("runPromptPresetImportStorageTransaction", () => {
  it("owns exclusive queue preparation, persistence publication, and cleanup ordering", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const importedPreset = promptPreset("prompt-preset-imported");
    const harness = transactionHarness(appStorageRecords([existingPreset]));
    const saveCollection = vi.fn(async () => {
      harness.events.push("save");
      return storageResult("ready", "Saved.");
    });

    const result = await runPromptPresetImportStorageTransaction({
      preset: importedPreset,
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(result).toMatchObject({ saved: true, blocked: false, message: "Saved." });
    expect(harness.events).toEqual([
      "cancel",
      "drain",
      "wait",
      "saving",
      "save",
      "metadata",
      "persisted-signature",
      "clear-pending",
      "clear-error",
      "set-unsaved",
      "status",
    ]);
    expect(harness.locked).toBe(false);
    expect(harness.persistedSignature).not.toBeNull();
  });

  it("rejects a competing import before touching queue or rollback state", async () => {
    const harness = transactionHarness(appStorageRecords([]));
    harness.locked = true;
    const saveCollection = vi.fn();

    const result = await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(result).toMatchObject({ saved: false, blocked: true });
    expect(harness.events).toEqual([]);
    expect(saveCollection).not.toHaveBeenCalled();
  });

  it("releases exclusivity when transaction setup throws", async () => {
    const harness = transactionHarness(appStorageRecords([]));
    harness.ports.cancelQueuedSaveDispatch = () => {
      throw new Error("queue setup failed");
    };

    const result = await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
    });

    expect(result).toMatchObject({
      saved: false,
      blocked: false,
      message: "queue setup failed",
    });
    expect(harness.locked).toBe(false);
  });

  it("stops before staging when the target changes while queued saves settle", async () => {
    const harness = transactionHarness(appStorageRecords([]));
    harness.ports.waitForActiveSaveToSettle = async () => {
      harness.events.push("wait");
      harness.targetCurrent = false;
    };
    const saveCollection = vi.fn();

    const result = await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(result).toMatchObject({
      saved: false,
      blocked: true,
      message: "Prompt preset save was interrupted because the storage target changed.",
    });
    expect(saveCollection).not.toHaveBeenCalled();
    expect(harness.events).not.toContain("flush");
    expect(harness.locked).toBe(false);
  });

  it("rolls back the latest original-target snapshot when the target changes during save", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const editedSnapshot = appStorageRecords([{ ...existingPreset, title: "Concurrent edit" }]);
    const harness = transactionHarness(appStorageRecords([existingPreset]));
    const savedSnapshots: AppStorageRecords[] = [];
    const saveCollection = vi.fn(async (snapshot: AppStorageRecords) => {
      savedSnapshots.push(snapshot);
      if (savedSnapshots.length === 1) {
        harness.rollbackSnapshot = editedSnapshot;
        harness.targetCurrent = false;
      }
      return storageResult("ready", "Saved.");
    });

    const result = await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(result).toMatchObject({ saved: false, blocked: true });
    expect(savedSnapshots).toHaveLength(2);
    expect(savedSnapshots[1]?.promptPresets).toEqual(editedSnapshot.promptPresets);
    expect(harness.events).not.toContain("persisted-signature");
    expect(harness.events).not.toContain("flush");
  });

  it("keeps a concurrent catalog edit dirty after the staged preset is persisted", async () => {
    const existingPreset = promptPreset("prompt-preset-existing");
    const editedSnapshot = appStorageRecords([{ ...existingPreset, title: "Concurrent edit" }]);
    const harness = transactionHarness(appStorageRecords([existingPreset]));
    const saveCollection = vi.fn(async () => {
      harness.currentSnapshot = editedSnapshot;
      return storageResult("ready", "Saved.");
    });

    await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(harness.unsavedSignature).not.toBeNull();
    expect(harness.unsavedSignature).not.toBe(harness.persistedSignature);
  });

  it("reconciles a confirmed rollback, publishes failure, then flushes remaining edits", async () => {
    const snapshot = appStorageRecords([promptPreset("prompt-preset-existing")]);
    const harness = transactionHarness(snapshot);
    const saveCollection = vi
      .fn()
      .mockResolvedValueOnce(storageResult("error", "Staged save failed."))
      .mockResolvedValueOnce(storageResult("ready", "Rollback saved."));

    const result = await runPromptPresetImportStorageTransaction({
      preset: promptPreset("prompt-preset-imported"),
      coordinator: harness.coordinator,
      ports: harness.ports,
      saveCollection,
    });

    expect(result).toMatchObject({ saved: false, blocked: false, message: "Staged save failed." });
    expect(harness.events).toContain("persisted-signature");
    expect(harness.events.indexOf("status")).toBeLessThan(harness.events.indexOf("flush"));
    expect(harness.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("holds exclusivity through failure cleanup and releases it when cleanup throws", async () => {
    const snapshot = appStorageRecords([promptPreset("prompt-preset-existing")]);
    const harness = transactionHarness(snapshot);
    harness.ports.flushFailureSaves = async () => {
      harness.events.push("flush");
      expect(harness.coordinator.hasActiveTransaction()).toBe(true);
      expect(harness.coordinator.tryBegin("bundle-import")).toBeNull();
      throw new Error("cleanup failed");
    };

    await expect(
      runPromptPresetImportStorageTransaction({
        preset: promptPreset("prompt-preset-imported"),
        coordinator: harness.coordinator,
        ports: harness.ports,
        saveCollection: vi.fn().mockResolvedValue(storageResult("error", "Save failed.")),
      }),
    ).rejects.toThrow("cleanup failed");

    expect(harness.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("releases exclusivity when status publication throws", async () => {
    const harness = transactionHarness(appStorageRecords([]));
    harness.ports.refreshSaveStatus = () => {
      throw new Error("status publication failed");
    };

    await expect(
      runPromptPresetImportStorageTransaction({
        preset: promptPreset("prompt-preset-imported"),
        coordinator: harness.coordinator,
        ports: harness.ports,
        saveCollection: vi.fn().mockResolvedValue(storageResult("ready", "Saved.")),
      }),
    ).rejects.toThrow("status publication failed");

    expect(harness.coordinator.hasActiveTransaction()).toBe(false);
  });
});
