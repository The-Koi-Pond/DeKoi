import { describe, expect, it } from "vitest";
import {
  appStorageAutoMigrationCollectionKeys,
  appStorageDroppedRecordSaveBlockCollectionKeys,
  createLoadedAppStorageSignatures,
  orderedAppStorageCollectionKeys,
  partitionAppStorageDirtyCollectionKeys,
  mergeAffectedAppStorageCollections,
  type AppStorageCollectionSignatures,
} from "./use-app-storage-sync";
import type { AppStorageRecords, AppStorageSnapshot } from "../features/runtime";

describe("unified mode storage sync bookkeeping", () => {
  it("keeps migrated collections distinct from their last durable signatures", () => {
    const snapshot = {
      appSettings: {},
      characters: [],
      personas: [],
      lorebooks: [],
      promptPresets: [],
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      modeThreads: [],
      rippleStates: [],
    } as unknown as AppStorageSnapshot;

    const signatures = createLoadedAppStorageSignatures(snapshot, ["modeThreads", "modeMessages"]);

    expect(signatures.modeThreads).not.toBe("[]");
    expect(signatures.modeMessages).not.toBe("[]");
    expect(signatures.characters).toBe("[]");
  });

  it("groups mode threads and messages for migration and dropped-record safety", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["modeThreads", "modeMessages"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["modeThreads", "modeMessages"]);
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["modeThreads", "modeMessages"],
        droppedRecordCountByCollection: { modeMessages: 1 },
      }),
    ).toEqual([]);
    expect(appStorageDroppedRecordSaveBlockCollectionKeys({ modeThreads: 1 })).toEqual([
      "modeThreads",
      "modeMessages",
    ]);
    expect(appStorageDroppedRecordSaveBlockCollectionKeys({ modeMessages: 1 })).toEqual([
      "modeThreads",
      "modeMessages",
    ]);
  });
  it("partitions unrelated dirty collections while blocking damaged mode data", () => {
    expect(
      partitionAppStorageDirtyCollectionKeys({
        dirtyCollectionKeys: ["characters", "modeThreads", "providerConnections"],
        blockedCollectionKeys: new Set(["modeThreads", "modeMessages"]),
      }),
    ).toEqual({
      blockedDirtyCollectionKeys: ["modeThreads"],
      saveableDirtyCollectionKeys: ["characters", "providerConnections"],
    });
  });
  it("orders prompt presets before app settings and merges only affected collections", () => {
    expect(
      orderedAppStorageCollectionKeys(["appSettings", "promptPresets", "modeThreads"]),
    ).toEqual(["promptPresets", "appSettings", "modeThreads"]);
    const current = {
      characters: [{ id: "current" }],
      modeThreads: [{ id: "old" }],
    } as unknown as AppStorageRecords;
    const candidate = {
      characters: [{ id: "candidate" }],
      modeThreads: [{ id: "new" }],
    } as unknown as AppStorageRecords;
    expect(
      mergeAffectedAppStorageCollections(current, candidate, ["modeThreads"]).modeThreads,
    ).toEqual([{ id: "new" }]);
    expect(
      mergeAffectedAppStorageCollections(current, candidate, ["modeThreads"]).characters,
    ).toEqual([{ id: "current" }]);
  });
  it("keeps signature maps typed for unified collections", () => {
    const signatures = {
      modeThreads: "threads",
      modeMessages: "messages",
    } as unknown as AppStorageCollectionSignatures;
    expect(signatures.modeThreads).toBe("threads");
    expect(signatures.modeMessages).toBe("messages");
  });
});
