import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createRoleplayThread } from "../../../engine/modes/roleplay/roleplay-actions";
import { createStorageTransactionCoordinator } from "./storage-transaction-coordinator";
import { runPromptPresetRelationshipTransaction } from "./prompt-preset-relationship-transaction";
import { planPromptPresetDeletion } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type { AppStorageRecords } from "./app-storage-workflows";
import { appStorageCollectionSignature } from "./app-storage-workflows";

const preset = {
  id: "preset-default",
  schemaVersion: 1 as const,
  title: "Default",
  systemPrompt: "Use it.",
  sectionOrder: [],
  groupOrder: [],
  variableOrder: [],
  variableGroups: [],
  variableValues: {},
  defaultChoices: {},
  sections: [],
  groups: [],
  choiceBlocks: [],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

const deletedPreset = { ...preset, id: "preset-delete", title: "Delete" };

function snapshot(): AppStorageRecords {
  return {
    appSettings: { ...DEFAULT_APP_SETTINGS, defaultPromptPresetId: preset.id },
    promptPresets: [preset, deletedPreset],
    messengerThreads: [
      createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        defaultPromptPresetId: deletedPreset.id,
        id: "messenger",
        now: "2026-01-01",
        title: "Messenger",
      }),
    ],
    roleplayThreads: [
      createRoleplayThread({
        activePersonaId: null,
        characterIds: [],
        defaultPromptPresetId: deletedPreset.id,
        id: "roleplay",
        now: "2026-01-01",
        title: "Roleplay",
      }),
    ],
    characters: [],
    personas: [],
    lorebooks: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    rippleStates: [],
  };
}

describe("prompt preset relationship transaction", () => {
  it("persists affected modes before deleting the preset and publishes once", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const saved: string[] = [];
    let published = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saved.push(key);
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: () => {
        published += 1;
      },
    });

    expect(result.saved).toBe(true);
    expect(saved).toEqual(["messengerThreads", "roleplayThreads", "promptPresets"]);
    expect(published).toBe(1);
  });

  it("rejects default deletion without writes or publication", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let writes = 0;
    let published = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: preset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async () => {
        writes += 1;
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: () => {
        published += 1;
      },
    });

    expect(result.saved).toBe(false);
    expect(writes).toBe(0);
    expect(published).toBe(0);
  });

  it("rejects invalid defaults and the last preset before any write", () => {
    const initial = snapshot();
    expect(
      planPromptPresetDeletion(
        { ...initial, appSettings: { ...initial.appSettings, defaultPromptPresetId: null } },
        deletedPreset.id,
        "2026-01-02",
      ),
    ).toMatchObject({ ok: false, reason: "invalid-default" });
    expect(
      planPromptPresetDeletion(
        {
          ...initial,
          promptPresets: [preset],
          appSettings: { ...initial.appSettings, defaultPromptPresetId: preset.id },
        },
        preset.id,
        "2026-01-02",
      ),
    ).toMatchObject({ ok: false, reason: "default" });
    expect(
      planPromptPresetDeletion(
        {
          ...initial,
          promptPresets: [deletedPreset],
          appSettings: { ...initial.appSettings, defaultPromptPresetId: "other" },
        },
        deletedPreset.id,
        "2026-01-02",
      ),
    ).toMatchObject({ ok: false, reason: "last-preset" });
  });

  it("aborts and reloads when an affected collection changes during a save", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const resolveSave: { current: (() => void) | null } = { current: null };
    let persistedSnapshot: AppStorageRecords | null = null;
    let published = 0;
    const resultPromise = runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (candidate) =>
        new Promise((resolve) => {
          persistedSnapshot = candidate;
          resolveSave.current = () => resolve({ status: "ready", message: "saved" });
        }),
      reload: async () => initial,
      publish: () => {
        published += 1;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    coordinator.publishCurrentState(
      { generation: 1, rawUrl: "test" },
      {
        ...initial,
        messengerThreads: [
          ...initial.messengerThreads,
          { ...initial.messengerThreads[0]!, id: "new" },
        ],
      },
    );
    resolveSave.current?.();
    const result = await resultPromise;
    expect(result.blocked).toBe(true);
    expect(result.published).toBe(false);
    expect(published).toBe(0);
    expect(result.persistedSignatures).toEqual({
      messengerThreads: appStorageCollectionSignature(persistedSnapshot!, "messengerThreads"),
    });
  });

  it("publishes only affected collections when an unrelated edit occurs", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const publishedKeys: string[][] = [];
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        if (key === "messengerThreads") {
          coordinator.publishCurrentState(
            { generation: 1, rawUrl: "test" },
            { ...initial, characters: [{ id: "unrelated" }] as never },
          );
        }
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: (_candidate, keys) => publishedKeys.push([...keys]),
    });
    expect(result.published).toBe(true);
    expect(publishedKeys).toEqual([["messengerThreads", "roleplayThreads", "promptPresets"]]);
  });

  it("writes only the changed thread collections before presets", async () => {
    const initial = { ...snapshot(), roleplayThreads: [] };
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const saved: string[] = [];
    await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saved.push(key);
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: () => undefined,
    });
    expect(saved).toEqual(["messengerThreads", "promptPresets"]);
  });

  it("writes only prompt presets when deletion reassigns no threads", async () => {
    const base = snapshot();
    const initial: AppStorageRecords = {
      ...base,
      messengerThreads: base.messengerThreads.map((thread) => ({
        ...thread,
        presetId: preset.id,
      })),
      roleplayThreads: base.roleplayThreads.map((thread) => ({
        ...thread,
        presetId: preset.id,
      })),
    };
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const saved: string[] = [];
    const publications: { snapshot: typeof initial; keys: readonly string[] }[] = [];

    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saved.push(key);
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: (candidate, keys) => publications.push({ snapshot: candidate, keys }),
    });

    expect(result.saved).toBe(true);
    expect(result.published).toBe(true);
    expect(saved).toEqual(["promptPresets"]);
    expect(publications).toHaveLength(1);
    expect(publications[0]?.keys).toEqual(["promptPresets"]);
    expect(publications[0]?.snapshot.messengerThreads).toEqual(initial.messengerThreads);
    expect(publications[0]?.snapshot.roleplayThreads).toEqual(initial.roleplayThreads);
  });

  it("reloads after a target change between save positions", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let reloads = 0;
    let saves = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saves += 1;
        if (key === "messengerThreads")
          coordinator.publishCurrentState({ generation: 2, rawUrl: "changed" }, initial);
        return { status: "ready", message: "saved" };
      },
      reload: async () => {
        reloads += 1;
        return initial;
      },
      publish: () => undefined,
    });
    expect(result.blocked).toBe(true);
    expect(result.published).toBe(false);
    expect(saves).toBe(1);
    expect(reloads).toBe(1);
  });

  it("does not save or publish an unchanged default", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let saves = 0;
    let published = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "set-default", presetId: preset.id },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async () => {
        saves += 1;
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: () => {
        published += 1;
      },
    });
    expect(result.saved).toBe(false);
    expect(saves).toBe(0);
    expect(published).toBe(0);
  });

  it("reports partial-save recovery when a collection save and reload both fail", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let reloads = 0;
    let published = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async () => ({ status: "error", message: "write failed" }),
      reload: async () => {
        reloads += 1;
        throw new Error("read failed");
      },
      publish: () => {
        published += 1;
      },
    });
    expect(result.saved).toBe(false);
    expect(result.published).toBe(false);
    expect(reloads).toBe(1);
    expect(published).toBe(0);
    expect(result.message).toContain("reload failed");
  });

  it("does not reload over an affected edit that arrives with a failed save", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let reloads = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async () => {
        coordinator.publishCurrentState(
          { generation: 1, rawUrl: "test" },
          {
            ...initial,
            messengerThreads: [
              ...initial.messengerThreads,
              { ...initial.messengerThreads[0]!, id: "new" },
            ],
          },
        );
        return { status: "error", message: "write failed" };
      },
      reload: async () => {
        reloads += 1;
        return initial;
      },
      publish: () => undefined,
    });
    expect(result.blocked).toBe(true);
    expect(reloads).toBe(0);
    expect(result.message).toContain("newer in-memory edit was preserved");
  });

  it("does not reload over an unrelated edit that arrives with a failed save", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    let reloads = 0;
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async () => {
        coordinator.publishCurrentState(
          { generation: 1, rawUrl: "test" },
          { ...initial, characters: [{ id: "unrelated" }] as never },
        );
        return { status: "error", message: "write failed" };
      },
      reload: async () => {
        reloads += 1;
        return initial;
      },
      publish: () => undefined,
    });
    expect(result.blocked).toBe(true);
    expect(reloads).toBe(0);
    expect(result.message).toContain("newer in-memory edit was preserved");
  });

  it("sets a valid default through the same staged port and rejects missing IDs", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const saved: string[] = [];
    let published = 0;
    const success = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "set-default", presetId: deletedPreset.id },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saved.push(key);
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: () => {
        published += 1;
      },
    });
    expect(success.saved).toBe(true);
    expect(saved).toEqual(["appSettings"]);
    expect(published).toBe(1);

    const missing = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "set-default", presetId: "missing" },
      coordinator: createStorageTransactionCoordinator({ generation: 1, rawUrl: "test" }, initial),
      getLatestSnapshot: () => initial,
      saveCollection: async () => ({ status: "ready", message: "saved" }),
      reload: async () => initial,
      publish: () => undefined,
    });
    expect(missing.saved).toBe(false);
    expect(missing.message).toContain("not found");
  });
});
