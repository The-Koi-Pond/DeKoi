import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import {
  createStorageTransactionCoordinator,
  type StorageTransactionTarget,
} from "./storage-transaction-coordinator";
import { runPromptPresetCatalogTransaction } from "./prompt-preset-catalog-transaction";
import type { AppStorageRecords } from "./app-storage-workflows";

const records = (updatedAt = "1"): AppStorageRecords => ({
  appSettings: { ...DEFAULT_APP_SETTINGS, defaultPromptPresetId: "p" },
  characters: [character("character-1", "Keep me")],
  personas: [],
  lorebooks: [],
  promptPresets: [
    {
      id: "p",
      schemaVersion: 1,
      title: "Old",
      summary: null,
      systemPrompt: "",
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
      createdAt: "1",
      updatedAt,
    },
  ],
  loreRuntimeStates: [],
  macroVariableStates: [],
  providerConnections: [],
  roleplayThreads: [],
  messengerThreads: [],
  rippleStates: [],
});

function character(id: string, displayName: string): AppStorageRecords["characters"][number] {
  return {
    id,
    schemaVersion: 1,
    displayName,
    nickname: null,
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    alternateGreetings: [],
    groupOnlyGreetings: [],
    exampleMessages: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creator: "",
    characterVersion: "",
    creatorNotes: "",
    tags: [],
    characterNote: "",
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0,
    avatarUrl: null,
    lorebookIds: [],
    createdAt: "1",
    updatedAt: "1",
  };
}

function setup(initial = records()) {
  let current = initial;
  let published = 0;
  const coordinator = createStorageTransactionCoordinator({ generation: 0, rawUrl: "u" }, current);
  return {
    coordinator,
    get: () => current,
    set: (next: AppStorageRecords) => {
      current = next;
      coordinator.publishCurrentState({ generation: 0, rawUrl: "u" }, next);
    },
    publish: (next: AppStorageRecords) => {
      current = {
        ...current,
        promptPresets: next.promptPresets,
      };
      published++;
      coordinator.publishCurrentState({ generation: 0, rawUrl: "u" }, current);
    },
    count: () => published,
  };
}

type RunOptions = {
  save?: (
    snapshot: AppStorageRecords,
    rawUrl: string,
  ) => Promise<{
    status: "ready" | "error";
    message: string;
  }>;
  rollback?: (
    snapshot: AppStorageRecords,
    rawUrl: string,
    target: StorageTransactionTarget,
  ) => Promise<{
    status: "ready" | "error";
    message: string;
  }>;
  publish?: (snapshot: AppStorageRecords) => void;
};

function run(
  h: ReturnType<typeof setup>,
  options: RunOptions = {},
  mutation = {
    kind: "update" as const,
    presetId: "p",
    originalUpdatedAt: "1",
    now: "2",
    input: { title: "New" },
  },
) {
  return runPromptPresetCatalogTransaction({
    mutation,
    coordinator: h.coordinator,
    getLatestSnapshot: h.get,
    flush: async () => ({ flushed: true, message: "" }),
    saveCollection: options.save ?? (async () => ({ status: "ready", message: "" })),
    rollback: options.rollback ?? (async () => ({ status: "ready", message: "" })),
    publish: options.publish ?? h.publish,
  });
}

describe("prompt preset catalog transaction", () => {
  it("does not publish before delayed save and publishes once after success", async () => {
    const h = setup();
    let resolveSave!: () => void;
    const promise = run(h, {
      save: async () => {
        await new Promise<void>((resolve) => {
          resolveSave = resolve;
        });
        return { status: "ready", message: "" };
      },
    });
    expect(h.count()).toBe(0);
    await Promise.resolve();
    resolveSave();
    await promise;
    expect(h.count()).toBe(1);
    expect(h.get().promptPresets[0].title).toBe("New");
  });

  it.each([
    ["save error", async () => ({ status: "error" as const, message: "disk full" })],
    [
      "thrown save",
      async () => {
        throw new Error("host disconnected");
      },
    ],
  ])("does not publish after a %s", async (_label, save) => {
    const h = setup();
    const result = await run(h, { save });
    expect(result.saved).toBe(false);
    expect(result.published).toBe(false);
    expect(result.message).toMatch(/disk full|host disconnected/);
    expect(h.count()).toBe(0);
    expect(h.get().promptPresets[0].title).toBe("Old");
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("rolls back the latest snapshot after a save error", async () => {
    const h = setup();
    const latest = { ...h.get(), characters: [character("character-2", "Newer")] };
    let rollbackSnapshot: AppStorageRecords | null = null;
    const result = await run(h, {
      save: async () => {
        h.set(latest);
        return { status: "error", message: "response lost" };
      },
      rollback: async (snapshot) => {
        rollbackSnapshot = snapshot;
        return { status: "ready", message: "restored" };
      },
    });
    expect(result.saved).toBe(false);
    expect(result.published).toBe(false);
    expect(result.message).toBe("response lost");
    expect(rollbackSnapshot).toBe(latest);
    expect(h.count()).toBe(0);
    expect(h.get().promptPresets[0].title).toBe("Old");
  });

  it("reports rollback failure after a save error", async () => {
    const h = setup();
    const result = await run(h, {
      save: async () => ({ status: "error", message: "response lost" }),
      rollback: async () => ({ status: "error", message: "rollback disk full" }),
    });
    expect(result.saved).toBe(false);
    expect(result.published).toBe(false);
    expect(result.message).toContain("response lost");
    expect(result.message).toContain("rollback failed");
    expect(result.message).toContain("rollback disk full");
    expect(h.count()).toBe(0);
    expect(h.get().promptPresets[0].title).toBe("Old");
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it.each([
    ["stale", records("2"), "1"],
    ["missing", records("1"), ""],
  ])("rejects a %s original version before writing", async (_label, initial, originalUpdatedAt) => {
    const h = setup(initial);
    let writes = 0;
    const result = await run(
      h,
      {
        save: async () => {
          writes++;
          return { status: "ready", message: "" };
        },
      },
      { kind: "update", presetId: "p", originalUpdatedAt, now: "3", input: { title: "New" } },
    );
    expect(result.saved).toBe(false);
    expect(result.message).toMatch(/changed elsewhere/);
    expect(writes).toBe(0);
  });

  it("rejects overlap and releases the lock after the first save", async () => {
    const h = setup();
    let resolveSave!: () => void;
    const first = run(h, {
      save: async () => {
        await new Promise<void>((resolve) => {
          resolveSave = resolve;
        });
        return { status: "ready", message: "" };
      },
    });
    const overlap = await run(h);
    expect(overlap.blocked).toBe(true);
    resolveSave();
    await first;
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
    expect(
      (
        await run(h, undefined, {
          kind: "update",
          presetId: "p",
          originalUpdatedAt: "2",
          now: "3",
          input: { title: "Again" },
        })
      ).saved,
    ).toBe(true);
  });

  it.each([
    [
      "target",
      (h: ReturnType<typeof setup>, snapshot: AppStorageRecords) =>
        h.coordinator.publishCurrentState({ generation: 1, rawUrl: "next" }, snapshot),
    ],
    [
      "prompt-preset signature",
      (h: ReturnType<typeof setup>, snapshot: AppStorageRecords) =>
        h.set({
          ...snapshot,
          promptPresets: snapshot.promptPresets.map((p) => ({ ...p, title: "Concurrent" })),
        }),
    ],
  ])("rolls back after a successful save followed by a stale %s", async (_label, change) => {
    const h = setup();
    let rollbackSnapshot: AppStorageRecords | null = null;
    let rollbackUrl = "";
    let rollbackGeneration = -1;
    const result = await run(h, {
      save: async (snapshot, rawUrl) => {
        change(h, snapshot);
        expect(rawUrl).toBe("u");
        return { status: "ready", message: "saved" };
      },
      rollback: async (snapshot, rawUrl, target) => {
        rollbackSnapshot = snapshot;
        rollbackUrl = rawUrl;
        rollbackGeneration = target.generation;
        return { status: "ready", message: "restored" };
      },
    });
    expect(result.saved).toBe(false);
    expect(result.published).toBe(false);
    expect(result.message).toMatch(/rolled back/);
    expect(rollbackUrl).toBe("u");
    expect(rollbackGeneration).toBe(0);
    expect(rollbackSnapshot).not.toBeNull();
    expect(h.count()).toBe(0);
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("reports rollback failure truthfully and still releases the lock", async () => {
    const h = setup();
    const result = await run(h, {
      save: async (snapshot) => {
        h.set({
          ...snapshot,
          promptPresets: snapshot.promptPresets.map((p) => ({ ...p, title: "Concurrent" })),
        });
        return { status: "ready", message: "saved" };
      },
      rollback: async () => ({ status: "error", message: "rollback disk full" }),
    });
    expect(result.published).toBe(false);
    expect(result.message).toContain("rollback failed");
    expect(result.message).toContain("rollback disk full");
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("converts a thrown rollback after a save error into a transaction result", async () => {
    const h = setup();
    const result = await run(h, {
      save: async () => ({ status: "error", message: "save failed" }),
      rollback: async () => {
        throw new Error("rollback host disconnected");
      },
    });
    expect(result).toMatchObject({ saved: false, published: false, blocked: false });
    expect(result.message).toContain("save failed");
    expect(result.message).toContain("rollback host disconnected");
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("converts a thrown rollback after stale publication state into a transaction result", async () => {
    const h = setup();
    const result = await run(h, {
      save: async (snapshot) => {
        h.set({
          ...snapshot,
          promptPresets: snapshot.promptPresets.map((preset) => ({
            ...preset,
            title: "Concurrent",
          })),
        });
        return { status: "ready", message: "saved" };
      },
      rollback: async () => {
        throw "rollback unavailable";
      },
    });
    expect(result).toMatchObject({ saved: false, published: false, blocked: true });
    expect(result.message).toContain("rollback unavailable");
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("allows a retry after a stale transaction releases its lock", async () => {
    const h = setup();
    await run(h, {
      save: async () => {
        h.coordinator.publishCurrentState({ generation: 1, rawUrl: "next" }, h.get());
        return { status: "ready", message: "saved" };
      },
    });
    const retry = await run(
      h,
      {},
      {
        kind: "update",
        presetId: "p",
        originalUpdatedAt: "1",
        now: "3",
        input: { title: "Retry" },
      },
    );
    expect(retry.saved).toBe(true);
    expect(h.coordinator.hasActiveTransaction()).toBe(false);
  });

  it("publishes only prompt presets into the latest live snapshot", async () => {
    const h = setup();
    const result = await run(h, {
      save: async () => {
        h.set({ ...h.get(), characters: [character("character-2", "Newer")] });
        return { status: "ready", message: "" };
      },
    });
    expect(result.published).toBe(true);
    expect(h.get().promptPresets[0].title).toBe("New");
    expect(h.get().characters).toEqual([character("character-2", "Newer")]);
  });
});
