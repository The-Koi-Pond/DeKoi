import { describe, expect, it } from "vitest";

import {
  appStorageAutoMigrationCollectionKeys,
  appStorageDroppedRecordSaveBlockCollectionKeys,
  orderedAppStorageCollectionKeys,
  partitionAppStorageDirtyCollectionKeys,
  shouldBlockAppSettingsPromptPresetStarterSave,
} from "./use-app-storage-sync";

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
