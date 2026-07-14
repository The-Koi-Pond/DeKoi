import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeRemote } from "../../shared/api/remote-runtime";
import { RUNTIME_COMMANDS } from "../../shared/api/runtime-commands";
import { DEFAULT_APP_SETTINGS } from "../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../engine/modes/messenger/messenger-actions";
import { createModeMessage } from "../../engine/modes/mode-thread/mode-thread-actions";
import { STARTER_PROMPT_PRESET } from "../../engine/prompt-presets/starter-preset";
import type { ModeMessage } from "../../engine/contracts/types/mode-thread";
import {
  loadAppStorageSnapshot,
  replaceAppStorageSnapshot,
  saveAppStorageCollections,
  summarizeAppStorageDroppedRecords,
  type AppStorageRecords,
} from "./app-storage-snapshot";
import { STORAGE_ENTITIES, type StorageEntity } from "./storage-entities";

vi.mock("../../shared/api/remote-runtime", () => ({ invokeRemote: vi.fn() }));
const now = "2026-06-24T07:00:00.000Z";
const thread = createMessengerThread({
  id: "thread-1",
  branchId: "branch-active",
  title: "Chat",
  characterIds: [],
  activePersonaId: null,
  systemPrompt: "System",
  now,
});
const inactiveBranch = { ...thread.branches[0], id: "branch-inactive", threadId: thread.id };
const message = (branchId: string, id: string, body: string): ModeMessage =>
  createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: thread.id,
    branchId,
    author: { kind: "system", label: "System" },
    body,
    origin: "manual",
    now,
  });
function mockList(records: Partial<Record<StorageEntity, unknown[]>>) {
  vi.mocked(invokeRemote).mockImplementation(async (command, args) => {
    if (command === RUNTIME_COMMANDS.storageList)
      return records[(args as { entity: StorageEntity }).entity] ?? [];
    if (command === RUNTIME_COMMANDS.storageReplace)
      return { ok: true, count: (args as { records: unknown[] }).records.length };
    throw new Error(`Unexpected command ${command}`);
  });
}
function emptyRecords(): AppStorageRecords {
  return {
    appSettings: DEFAULT_APP_SETTINGS,
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    modeThreads: [],
    rippleStates: [],
  };
}

describe("unified mode storage", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });
  it("assembles threads and messages losslessly, including inactive branch/version", async () => {
    const { messages: _messages, ...threadStorage } = thread;
    void _messages;
    const savedThread = { ...threadStorage, branches: [thread.branches[0], inactiveBranch] };
    const active = message("branch-active", "message-active", "hello");
    const inactive = message("branch-inactive", "message-inactive", "inactive");
    inactive.versions.push({
      ...inactive.versions[0],
      id: `${inactive.id}-v2`,
      body: "inactive edited",
      origin: "generated",
    });
    inactive.activeVersionId = `${inactive.id}-v2`;
    mockList({
      [STORAGE_ENTITIES.modeThreads]: [savedThread],
      [STORAGE_ENTITIES.modeMessages]: [active, inactive],
    });
    const result = await loadAppStorageSnapshot("http://runtime.test");
    expect(result.modeThreads[0]?.branches.map((b) => b.id)).toEqual([
      "branch-active",
      "branch-inactive",
    ]);
    expect(result.modeThreads.flatMap((thread) => thread.messages)).toEqual([active, inactive]);
    expect(result.modeThreads[0]?.messages).toEqual([active, inactive]);
  });
  it("drops orphan and mismatched messages and reports their count", async () => {
    const valid = message("branch-active", "valid", "ok");
    const orphan = { ...valid, id: "orphan", threadId: "missing" };
    const mismatched = { ...valid, id: "mismatch", branchId: "other-branch" };
    const { messages: _messages, ...threadStorage } = thread;
    void _messages;
    mockList({
      [STORAGE_ENTITIES.modeThreads]: [threadStorage],
      [STORAGE_ENTITIES.modeMessages]: [valid, orphan, mismatched],
    });
    const result = await loadAppStorageSnapshot("http://runtime.test");
    expect(result.modeThreads.flatMap((thread) => thread.messages).map((m) => m.id)).toEqual([
      "valid",
    ]);
    expect(result.droppedRecordCountByCollection.modeMessages).toBe(2);
  });
  it("rejects mode thread storage with branch IDs shared across threads", async () => {
    const { messages: _messages, ...threadStorage } = thread;
    void _messages;
    const secondThread = createMessengerThread({
      id: "thread-2",
      branchId: thread.activeBranchId,
      title: "Second",
      characterIds: [],
      activePersonaId: null,
      now,
    });
    const { messages: _secondMessages, ...secondThreadStorage } = secondThread;
    void _secondMessages;
    mockList({
      [STORAGE_ENTITIES.modeThreads]: [threadStorage, secondThreadStorage],
      [STORAGE_ENTITIES.modeMessages]: [message("branch-active", "message-1", "hello")],
    });

    const result = await loadAppStorageSnapshot("http://runtime.test");

    expect(result.modeThreads).toEqual([]);
    expect(result.storageResult.status).toBe("error");
    expect(result.loadErrorMessageByCollection.modeThreads).toContain(
      "branch IDs shared across threads: branch-active",
    );
  });
  it("repairs prompt preset references on active and inactive branches and marks both collections", async () => {
    const { messages: _messages, ...threadStorage } = thread;
    void _messages;
    const storedThread = {
      ...threadStorage,
      branches: [
        { ...thread.branches[0], presetId: "missing-preset" },
        {
          ...inactiveBranch,
          presetId: "missing-preset",
          presetChoiceSelectionsByPresetId: {
            "missing-preset": { stale: { kind: "option", optionId: "kept" } },
          },
        },
      ],
    };
    mockList({
      [STORAGE_ENTITIES.modeThreads]: [storedThread],
      [STORAGE_ENTITIES.promptPresets]: [STARTER_PROMPT_PRESET],
    });
    const result = await loadAppStorageSnapshot("http://runtime.test");
    expect(result.modeThreads[0]?.branches.map((branch) => branch.presetId)).toEqual([
      STARTER_PROMPT_PRESET.id,
      STARTER_PROMPT_PRESET.id,
    ]);
    expect(result.modeThreads[0]?.branches[1]?.presetChoiceSelectionsByPresetId).toEqual({
      "missing-preset": { stale: { kind: "option", optionId: "kept" } },
    });
    expect(result.migrationCollectionKeys).toEqual(
      expect.arrayContaining(["modeThreads", "modeMessages"]),
    );
  });
  it("keeps a thread with malformed preset history and queues its normalized rewrite", async () => {
    const { messages: _messages, ...threadStorage } = thread;
    void _messages;
    mockList({
      [STORAGE_ENTITIES.modeThreads]: [
        {
          ...threadStorage,
          branches: [{ ...thread.branches[0], presetChoiceSelectionsByPresetId: [] }],
        },
      ],
    });
    const result = await loadAppStorageSnapshot("http://runtime.test");
    expect(result.modeThreads).toHaveLength(1);
    expect(result.modeThreads[0]?.branches[0]?.presetChoiceSelectionsByPresetId).toEqual({});
    expect(result.migrationCollectionKeys).toEqual(
      expect.arrayContaining(["modeThreads", "modeMessages"]),
    );
  });
  it("saves and replaces unified collections, while exposing dropped-record warnings", async () => {
    mockList({});
    const snapshot = {
      ...emptyRecords(),
      modeThreads: [{ ...thread, messages: [message("branch-active", "m", "body")] }],
    };
    const saved = await saveAppStorageCollections(
      snapshot,
      ["modeThreads", "modeMessages"],
      "http://runtime.test",
    );
    expect(saved.status).toBe("ready");
    const replaced = await replaceAppStorageSnapshot(snapshot, "http://runtime.test");
    expect(replaced.status).toBe("ready");
    expect(replaced.counts.modeThreads).toBe(1);
    expect(summarizeAppStorageDroppedRecords({ modeMessages: 2 }).message).toContain(
      "Mode messages (2)",
    );
  });
});

describe("storage recovery assertions", () => {
  it("keeps dropped-record warning empty when no records were dropped", () => {
    expect(summarizeAppStorageDroppedRecords({}).total).toBe(0);
  });
});
