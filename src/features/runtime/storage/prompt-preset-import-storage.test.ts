import { describe, expect, it, vi } from "vitest";

import type { AppStorageRecords } from "./app-storage-workflows";
import {
  promptPresetPersistenceSignatures,
  saveStagedPromptPresetToStorage,
} from "./prompt-preset-import-storage";

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
    isDefault: false,
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
    roleplayThreads: [],
    messengerThreads: [],
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
