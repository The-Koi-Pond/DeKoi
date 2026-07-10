import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "../../shared/api/remote-runtime";
import { RUNTIME_COMMANDS } from "../../shared/api/runtime-commands";
import { DEFAULT_APP_SETTINGS } from "../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../engine/modes/messenger/messenger-actions";
import { createRoleplayThread } from "../../engine/modes/roleplay/roleplay-actions";
import { STARTER_PROMPT_PRESET } from "../../engine/prompt-presets/starter-preset";
import {
  APP_STORAGE_COLLECTION_KEYS,
  loadAppStorageSnapshot,
  replaceAppStorageSnapshot,
  saveAppStorageCollections,
  summarizeAppStorageDroppedRecords,
  type AppStorageRecords,
} from "./app-storage-snapshot";
import { STORAGE_ENTITIES, type StorageEntity } from "./storage-entities";

vi.mock("../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
}));

function mockRemoteStorage(recordsByEntity: Partial<Record<StorageEntity, unknown[]>>) {
  vi.mocked(invokeRemote).mockImplementation(async (command, args) => {
    if (command !== RUNTIME_COMMANDS.storageList) {
      throw new Error(`Unexpected remote command: ${command}`);
    }
    const entity = args && typeof args.entity === "string" ? (args.entity as StorageEntity) : null;
    if (!entity) throw new Error("storage_list requires args.entity.");
    return recordsByEntity[entity] ?? [];
  });
}

function createPromptPresetSeedSnapshot(): AppStorageRecords {
  return {
    appSettings: {
      ...DEFAULT_APP_SETTINGS,
      promptPresetStarterInitialized: true,
    },
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets: [STARTER_PROMPT_PRESET],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    roleplayThreads: [],
    messengerThreads: [],
    rippleStates: [],
  };
}

describe("loadAppStorageSnapshot prompt preset seeding", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("seeds the starter prompt preset on remote first run", async () => {
    mockRemoteStorage({});

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.promptPresets).toEqual([STARTER_PROMPT_PRESET]);
    expect(snapshot.appSettings.promptPresetStarterInitialized).toBe(true);
    expect(snapshot.migrationCollectionKeys).toEqual(["appSettings", "promptPresets"]);
  });

  it("keeps a saved empty remote prompt preset collection empty", async () => {
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings" }],
      "prompt-presets": [],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.promptPresets).toEqual([]);
    expect(snapshot.appSettings.promptPresetStarterInitialized).toBe(false);
    expect(snapshot.migrationCollectionKeys).toEqual([]);
  });

  it("does not initialize the starter marker from a damaged prompt preset collection", async () => {
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings" }],
      "prompt-presets": [{ id: "unreadable-preset" }],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.promptPresets).toEqual([]);
    expect(snapshot.appSettings.promptPresetStarterInitialized).toBe(false);
    expect(snapshot.migrationCollectionKeys).toEqual([]);
    expect(snapshot.droppedRecordCountByCollection.promptPresets).toBe(1);
  });

  it("preserves prompt preset Messenger prompt sources during load", async () => {
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings", promptPresetStarterInitialized: true }],
      "prompt-presets": [
        {
          ...STARTER_PROMPT_PRESET,
          id: "preset-with-messenger-source",
          messengerPrompt: "Messenger source prompt.",
        },
      ],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.promptPresets).toHaveLength(1);
    expect(snapshot.promptPresets[0]?.messengerPrompt).toBe("Messenger source prompt.");
  });

  it("does not migrate a saved empty remote collection after the marker exists", async () => {
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings", promptPresetStarterInitialized: true }],
      "prompt-presets": [],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.promptPresets).toEqual([]);
    expect(snapshot.appSettings.promptPresetStarterInitialized).toBe(true);
    expect(snapshot.migrationCollectionKeys).toEqual([]);
  });

  it("clears thread preset IDs that do not resolve to loaded prompt presets", async () => {
    const messengerThreadWithValidPreset = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        id: "messenger-thread-valid",
        now: "2026-06-24T07:00:00.000Z",
        title: "Messenger valid",
      }),
      presetId: STARTER_PROMPT_PRESET.id,
      presetChoiceSelections: {
        "removed-choice": { kind: "option", optionId: "removed-option" },
        tone: "legacy-value",
      },
    };
    const messengerThreadWithMissingPreset = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        id: "messenger-thread-missing",
        now: "2026-06-24T07:00:00.000Z",
        title: "Messenger missing",
      }),
      presetId: "missing-preset",
      presetChoiceSelections: { pacing: "slow" },
    };
    const roleplayThreadWithMissingPreset = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: [],
        id: "roleplay-thread-missing",
        now: "2026-06-24T07:00:00.000Z",
        title: "Roleplay missing",
      }),
      presetId: "missing-preset",
      presetChoiceSelections: { pacing: "slow" },
    };
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings", promptPresetStarterInitialized: true }],
      "prompt-presets": [STARTER_PROMPT_PRESET],
      "messenger-threads": [messengerThreadWithValidPreset, messengerThreadWithMissingPreset],
      "roleplay-threads": [roleplayThreadWithMissingPreset],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.messengerThreads.map((thread) => [thread.id, thread.presetId])).toEqual([
      ["messenger-thread-valid", STARTER_PROMPT_PRESET.id],
      ["messenger-thread-missing", null],
    ]);
    expect(snapshot.roleplayThreads.map((thread) => [thread.id, thread.presetId])).toEqual([
      ["roleplay-thread-missing", null],
    ]);
    expect(
      snapshot.messengerThreads.find((thread) => thread.id === "messenger-thread-valid")
        ?.presetChoiceSelections,
    ).toEqual({});
    expect(
      snapshot.messengerThreads.find((thread) => thread.id === "messenger-thread-missing")
        ?.presetChoiceSelections,
    ).toEqual({});
    expect(snapshot.roleplayThreads[0]?.presetChoiceSelections).toEqual({});
    expect(snapshot.migrationCollectionKeys).toEqual(["roleplayThreads", "messengerThreads"]);
  });

  it("does not migrate thread preset IDs that resolve to loaded prompt presets", async () => {
    const messengerThreadWithValidPreset = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        id: "messenger-thread-valid",
        now: "2026-06-24T07:00:00.000Z",
        title: "Messenger valid",
      }),
      presetId: STARTER_PROMPT_PRESET.id,
    };
    const roleplayThreadWithValidPreset = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: [],
        id: "roleplay-thread-valid",
        now: "2026-06-24T07:00:00.000Z",
        title: "Roleplay valid",
      }),
      presetId: STARTER_PROMPT_PRESET.id,
    };
    mockRemoteStorage({
      "app-settings": [{ id: "app-settings", promptPresetStarterInitialized: true }],
      "prompt-presets": [STARTER_PROMPT_PRESET],
      "messenger-threads": [messengerThreadWithValidPreset],
      "roleplay-threads": [roleplayThreadWithValidPreset],
    });

    const snapshot = await loadAppStorageSnapshot("http://runtime.test");

    expect(snapshot.messengerThreads[0]?.presetId).toBe(STARTER_PROMPT_PRESET.id);
    expect(snapshot.roleplayThreads[0]?.presetId).toBe(STARTER_PROMPT_PRESET.id);
    expect(snapshot.migrationCollectionKeys).toEqual([]);
  });
});

describe("saveAppStorageCollections prompt preset marker ordering", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("does not save the initialization marker when starter preset save fails", async () => {
    const replacedEntities: StorageEntity[] = [];
    vi.mocked(invokeRemote).mockImplementation(async (command, args) => {
      if (command !== RUNTIME_COMMANDS.storageReplace) {
        throw new Error(`Unexpected remote command: ${command}`);
      }
      const entity =
        args && typeof args.entity === "string" ? (args.entity as StorageEntity) : null;
      if (!entity) throw new Error("storage_replace requires args.entity.");
      replacedEntities.push(entity);
      if (entity === STORAGE_ENTITIES.promptPresets) {
        return { ok: false, count: 0 };
      }
      return { ok: true, count: 1 };
    });

    const result = await saveAppStorageCollections(
      createPromptPresetSeedSnapshot(),
      ["appSettings", "promptPresets"],
      "http://runtime.test",
    );

    expect(result.status).toBe("error");
    expect(replacedEntities).toEqual([STORAGE_ENTITIES.promptPresets]);
  });
});

describe("replaceAppStorageSnapshot prompt preset marker ordering", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("does not replace the initialization marker before starter preset replacement succeeds", async () => {
    const replacedEntities: StorageEntity[] = [];
    vi.mocked(invokeRemote).mockImplementation(async (command, args) => {
      if (command !== RUNTIME_COMMANDS.storageReplace) {
        throw new Error(`Unexpected remote command: ${command}`);
      }
      const entity =
        args && typeof args.entity === "string" ? (args.entity as StorageEntity) : null;
      const records = args && Array.isArray(args.records) ? args.records : null;
      if (!entity) throw new Error("storage_replace requires args.entity.");
      if (!records) throw new Error("storage_replace requires args.records.");
      replacedEntities.push(entity);
      if (entity === STORAGE_ENTITIES.promptPresets) {
        return { ok: false, count: 0 };
      }
      return { ok: true, count: records.length };
    });

    const result = await replaceAppStorageSnapshot(
      createPromptPresetSeedSnapshot(),
      "http://runtime.test",
    );

    expect(result.status).toBe("error");
    expect(result.failedCollectionKey).toBe("promptPresets");
    expect(replacedEntities).toEqual([STORAGE_ENTITIES.promptPresets]);
  });
});

describe("summarizeAppStorageDroppedRecords", () => {
  it("returns no message when nothing was dropped", () => {
    const result = summarizeAppStorageDroppedRecords({});
    expect(result.total).toBe(0);
    expect(result.message).toBe("");
  });

  it("ignores zero-count entries", () => {
    const result = summarizeAppStorageDroppedRecords({
      characters: 0,
      lorebooks: 0,
    });
    expect(result.total).toBe(0);
    expect(result.message).toBe("");
  });

  it("totals drops across collections and names each collection in the warning", () => {
    const result = summarizeAppStorageDroppedRecords({
      characters: 2,
      messengerMessages: 1,
    });

    expect(result.total).toBe(3);
    expect(result.message).toContain("3 unreadable record(s)");
    expect(result.message).toContain("Characters (2)");
    expect(result.message).toContain("Messenger messages (1)");
    // The warning must tell the user that saving erases the skipped records.
    expect(result.message.toLowerCase()).toContain("erase");
  });

  it("covers every collection key so labels never go missing", () => {
    // Every collection key should be accepted and surfaced when it has drops.
    for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
      const result = summarizeAppStorageDroppedRecords({ [collectionKey]: 1 });
      expect(result.total).toBe(1);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
