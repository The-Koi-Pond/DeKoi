import { describe, expect, it } from "vitest";

import {
  appStorageSnapshotsHaveMatchingSignatures,
  appStorageAutoMigrationCollectionKeys,
  appStorageDroppedRecordSaveBlockCollectionKeys,
  orderedAppStorageCollectionKeys,
  partitionAppStorageDirtyCollectionKeys,
  shouldBlockAppSettingsPromptPresetStarterSave,
  mergeAffectedAppStorageCollections,
  mergePersistedAppStorageTransactionSignatures,
  reconcilePublishedAppStorageTransactionBookkeeping,
  reconcileCurrentAppStorageTransactionBookkeeping,
  type AppStorageCollectionSignatures,
} from "./use-app-storage-sync";
import type { AppStorageRecords } from "../features/runtime";

describe("appStorageAutoMigrationCollectionKeys", () => {
  it("keeps complete migration groups with no dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: [
          "roleplayThreads",
          "roleplayEntries",
          "messengerThreads",
          "messengerMessages",
        ],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["roleplayThreads", "roleplayEntries", "messengerThreads", "messengerMessages"]);
  });

  it("skips a whole migration group when either collection had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: [
          "roleplayThreads",
          "roleplayEntries",
          "messengerThreads",
          "messengerMessages",
        ],
        droppedRecordCountByCollection: {
          roleplayThreads: 1,
          messengerMessages: 2,
        },
      }),
    ).toEqual([]);
  });

  it("keeps unaffected migration groups when another group had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: [
          "roleplayThreads",
          "roleplayEntries",
          "messengerThreads",
          "messengerMessages",
        ],
        droppedRecordCountByCollection: {
          roleplayEntries: 1,
        },
      }),
    ).toEqual(["messengerThreads", "messengerMessages"]);
  });

  it("keeps prompt preset seed migrations when the collection had no dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["promptPresets"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["promptPresets"]);
  });

  it("keeps the starter marker pair when both collections had no dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings", "promptPresets"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["appSettings", "promptPresets"]);
  });

  it("skips the starter marker pair when app settings had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings", "promptPresets"],
        droppedRecordCountByCollection: {
          appSettings: 1,
        },
      }),
    ).toEqual([]);
  });

  it("skips prompt preset seed migrations when the collection had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["promptPresets"],
        droppedRecordCountByCollection: {
          promptPresets: 1,
        },
      }),
    ).toEqual([]);
  });

  it("skips the starter marker pair when prompt presets had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings", "promptPresets"],
        droppedRecordCountByCollection: {
          promptPresets: 1,
        },
      }),
    ).toEqual([]);
  });

  it("skips app settings starter marker migrations when no preset seed is being saved", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual([]);
  });

  it("keeps single thread repair migrations when the collection had no dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["roleplayThreads", "messengerThreads"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["roleplayThreads", "messengerThreads"]);
  });

  it("skips single thread repair migrations when the repaired collection had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["roleplayThreads", "messengerThreads"],
        droppedRecordCountByCollection: {
          roleplayThreads: 1,
        },
      }),
    ).toEqual(["messengerThreads"]);
  });

  it("skips single thread repair migrations when their split transcript sibling had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["roleplayThreads", "messengerThreads"],
        droppedRecordCountByCollection: {
          roleplayEntries: 1,
          messengerMessages: 1,
        },
      }),
    ).toEqual([]);
  });
});

describe("mergeAffectedAppStorageCollections", () => {
  it("preserves unrelated ordinary edits while applying affected collections", () => {
    const current = {
      characters: [{ id: "current-character" }],
      messengerThreads: [{ id: "current-thread" }],
      promptPresets: [{ id: "current-preset" }],
    } as unknown as AppStorageRecords;
    const candidate = {
      characters: [{ id: "stale-character" }],
      messengerThreads: [{ id: "candidate-thread" }],
      promptPresets: [{ id: "candidate-preset" }],
    } as unknown as AppStorageRecords;

    const merged = mergeAffectedAppStorageCollections(current, candidate, ["messengerThreads"]);
    expect(merged.characters).toEqual(current.characters);
    expect(merged.promptPresets).toEqual(current.promptPresets);
    expect(merged.messengerThreads).toEqual(candidate.messengerThreads);
  });
});

describe("reconcilePublishedAppStorageTransactionBookkeeping", () => {
  it("marks affected collections saved while retaining unrelated dirty edits", () => {
    const snapshot = {
      appSettings: { defaultPromptPresetId: "preset-2" },
      characters: [{ id: "edited-character" }],
      personas: [],
      lorebooks: [],
      promptPresets: [{ id: "preset-2" }],
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      roleplayThreads: [],
      messengerThreads: [],
      rippleStates: [],
    } as unknown as AppStorageRecords;
    const result = reconcilePublishedAppStorageTransactionBookkeeping({
      savedSignatures: {
        appSettings: "old-settings",
        characters: "old-characters",
        messengerThreads: "old-messenger-threads",
        messengerMessages: "old-messenger-messages",
        roleplayThreads: "old-roleplay-threads",
        roleplayEntries: "old-roleplay-entries",
      } as unknown as AppStorageCollectionSignatures,
      unsavedSignatures: {
        characters: "edited-characters",
        appSettings: "old-settings",
        messengerThreads: "old-messenger-threads",
        messengerMessages: "old-messenger-messages",
        roleplayThreads: "old-roleplay-threads",
        roleplayEntries: "old-roleplay-entries",
      },
      snapshot,
      affectedKeys: ["appSettings", "messengerThreads", "roleplayThreads"],
    });

    expect(result.savedSignatures?.appSettings).not.toBe("old-settings");
    expect(result.savedSignatures?.messengerThreads).not.toBe("old-messenger-threads");
    expect(result.savedSignatures?.messengerMessages).toBe("old-messenger-messages");
    expect(result.savedSignatures?.roleplayThreads).not.toBe("old-roleplay-threads");
    expect(result.savedSignatures?.roleplayEntries).toBe("old-roleplay-entries");
    expect(result.unsavedSignatures).toEqual({
      characters: "edited-characters",
      messengerMessages: "old-messenger-messages",
      roleplayEntries: "old-roleplay-entries",
    });
    expect(result.lastSeenSnapshot).toBe(snapshot);
  });
});

describe("reconcileCurrentAppStorageTransactionBookkeeping", () => {
  it("reconciles all collections after a transaction without claiming unrelated edits are clean", () => {
    const snapshot = {
      appSettings: { defaultPromptPresetId: "preset-2" },
      characters: [{ id: "edited-character" }],
      personas: [],
      lorebooks: [],
      promptPresets: [{ id: "preset-2" }],
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      roleplayThreads: [],
      messengerThreads: [],
      rippleStates: [],
    } as unknown as AppStorageRecords;
    const result = reconcileCurrentAppStorageTransactionBookkeeping({
      savedSignatures: {
        appSettings: "old-settings",
        characters: "old-characters",
        messengerThreads: "old-messenger-threads",
        messengerMessages: "old-messenger-messages",
        roleplayThreads: "old-roleplay-threads",
        roleplayEntries: "old-roleplay-entries",
      } as unknown as AppStorageCollectionSignatures,
      snapshot,
    });

    expect(result.dirtyCollectionKeys).toContain("characters");
    expect(result.dirtyCollectionKeys).toContain("appSettings");
    expect(result.unsavedSignatures.characters).toBeDefined();
    expect(result.unsavedSignatures.appSettings).toBeDefined();
  });

  it("queues compensation when a transaction partially persisted an older collection", () => {
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
      messengerThreads: [{ id: "in-memory-thread", messages: [] }],
      rippleStates: [],
    } as unknown as AppStorageRecords;
    const savedSignatures = mergePersistedAppStorageTransactionSignatures(
      {
        messengerThreads: "previously-saved",
      } as unknown as AppStorageCollectionSignatures,
      { messengerThreads: "partially-persisted-transaction" },
    );

    const result = reconcileCurrentAppStorageTransactionBookkeeping({
      savedSignatures,
      snapshot,
    });

    expect(result.dirtyCollectionKeys).toContain("messengerThreads");
    expect(result.unsavedSignatures.messengerThreads).toBeDefined();
  });
});

describe("appStorageSnapshotsHaveMatchingSignatures", () => {
  it("detects an edit that arrives while a recovery load is pending", () => {
    const before: AppStorageRecords = {
      appSettings: {} as AppStorageRecords["appSettings"],
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
    };
    const unrelatedEdit = {
      ...before,
      characters: [{ id: "new-character" }] as typeof before.characters,
    };
    const affectedEdit = {
      ...before,
      messengerThreads: [{ id: "new-thread" }] as typeof before.messengerThreads,
    };

    expect(appStorageSnapshotsHaveMatchingSignatures(before, before)).toBe(true);
    expect(appStorageSnapshotsHaveMatchingSignatures(before, unrelatedEdit)).toBe(false);
    expect(appStorageSnapshotsHaveMatchingSignatures(before, affectedEdit)).toBe(false);
  });
});

describe("shouldBlockAppSettingsPromptPresetStarterSave", () => {
  it("blocks the initial starter marker save when prompt presets fail first", () => {
    expect(
      shouldBlockAppSettingsPromptPresetStarterSave({
        pendingAppSettingsPromptPresetStarterInitialized: true,
        savedAppSettingsPromptPresetStarterInitialized: false,
      }),
    ).toBe(true);
  });

  it("does not block later app settings saves after the marker was already saved", () => {
    expect(
      shouldBlockAppSettingsPromptPresetStarterSave({
        pendingAppSettingsPromptPresetStarterInitialized: true,
        savedAppSettingsPromptPresetStarterInitialized: true,
      }),
    ).toBe(false);
  });

  it("does not block app settings saves that are not committing the marker", () => {
    expect(
      shouldBlockAppSettingsPromptPresetStarterSave({
        pendingAppSettingsPromptPresetStarterInitialized: false,
        savedAppSettingsPromptPresetStarterInitialized: false,
      }),
    ).toBe(false);
  });
});

describe("appStorageDroppedRecordSaveBlockCollectionKeys", () => {
  it("blocks saving collections that loaded with dropped records and dependent transcript pairs", () => {
    expect(
      appStorageDroppedRecordSaveBlockCollectionKeys({
        characters: 2,
        messengerMessages: 0,
        roleplayThreads: 1,
      }),
    ).toEqual(["characters", "roleplayThreads", "roleplayEntries"]);
  });

  it("blocks whole split transcript groups with dropped records", () => {
    expect(
      appStorageDroppedRecordSaveBlockCollectionKeys({
        messengerThreads: 1,
      }),
    ).toEqual(["messengerThreads", "messengerMessages"]);
  });

  it("blocks split transcript thread saves when child records were dropped", () => {
    expect(
      appStorageDroppedRecordSaveBlockCollectionKeys({
        roleplayEntries: 1,
      }),
    ).toEqual(["roleplayThreads", "roleplayEntries"]);
  });
});

describe("orderedAppStorageCollectionKeys", () => {
  it("saves prompt preset starter records before the app-settings marker", () => {
    expect(orderedAppStorageCollectionKeys(["appSettings", "promptPresets", "characters"])).toEqual(
      ["promptPresets", "appSettings", "characters"],
    );
  });

  it("keeps normal collection order when the prompt preset marker dependency is absent", () => {
    expect(orderedAppStorageCollectionKeys(["characters", "appSettings"])).toEqual([
      "appSettings",
      "characters",
    ]);
  });
});

describe("partitionAppStorageDirtyCollectionKeys", () => {
  it("keeps unblocked dirty collections saveable when another dirty collection is blocked", () => {
    expect(
      partitionAppStorageDirtyCollectionKeys({
        dirtyCollectionKeys: ["characters", "providerConnections", "messengerThreads"],
        blockedCollectionKeys: new Set(["messengerThreads", "messengerMessages"]),
      }),
    ).toEqual({
      blockedDirtyCollectionKeys: ["messengerThreads"],
      saveableDirtyCollectionKeys: ["characters", "providerConnections"],
    });
  });
});
