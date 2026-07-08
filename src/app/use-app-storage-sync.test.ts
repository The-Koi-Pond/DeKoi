import { describe, expect, it } from "vitest";

import {
  appStorageAutoMigrationCollectionKeys,
  appStorageDroppedRecordSaveBlockCollectionKeys,
  orderedAppStorageCollectionKeys,
  partitionAppStorageDirtyCollectionKeys,
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

  it("keeps app settings migrations when the collection had no dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings", "promptPresets"],
        droppedRecordCountByCollection: {},
      }),
    ).toEqual(["appSettings", "promptPresets"]);
  });

  it("skips app settings migrations when the collection had dropped records", () => {
    expect(
      appStorageAutoMigrationCollectionKeys({
        migrationCollectionKeys: ["appSettings", "promptPresets"],
        droppedRecordCountByCollection: {
          appSettings: 1,
        },
      }),
    ).toEqual(["promptPresets"]);
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
