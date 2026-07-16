import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createRoleplayThread } from "../../../engine/modes/roleplay/roleplay-actions";
import type { MessengerModeThread } from "../../../engine/contracts/types/mode-thread";
import { planPromptPresetDeletion } from "../../../engine/prompt-presets/prompt-preset-relationship-actions";
import type { AppStorageRecords } from "./app-storage-workflows";
import { runPromptPresetRelationshipTransaction } from "./prompt-preset-relationship-transaction";
import { createStorageTransactionCoordinator } from "./storage-transaction-coordinator";

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
    modeThreads: [
      createMessengerThread({
        id: "messenger",
        branchId: "messenger-active",
        title: "Messenger",
        characterIds: [],
        activePersonaId: null,
        defaultPromptPresetId: deletedPreset.id,
        now: "2026-01-01",
      }),
      createRoleplayThread({
        id: "roleplay",
        branchId: "roleplay-active",
        title: "Roleplay",
        characterIds: [],
        activePersonaId: null,
        openingCharacter: null,
        defaultPromptPresetId: deletedPreset.id,
        now: "2026-01-01",
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
  it("reassigns every affected mode thread and publishes the unified collection", async () => {
    const initial = snapshot();
    const coordinator = createStorageTransactionCoordinator(
      { generation: 1, rawUrl: "test" },
      initial,
    );
    const saved: string[] = [];
    let publishedKeys: readonly string[] = [];
    const result = await runPromptPresetRelationshipTransaction({
      mutation: { kind: "delete", presetId: deletedPreset.id, updatedAt: "2026-01-02" },
      coordinator,
      getLatestSnapshot: () => initial,
      saveCollection: async (_candidate, key) => {
        saved.push(key);
        return { status: "ready", message: "saved" };
      },
      reload: async () => initial,
      publish: (candidate, keys) => {
        publishedKeys = keys;
        expect(
          candidate.modeThreads.every((thread) =>
            thread.branches.every((branch) => branch.presetId === preset.id),
          ),
        ).toBe(true);
      },
    });

    expect(result.saved).toBe(true);
    expect(saved).toEqual(["modeThreads", "promptPresets"]);
    expect(publishedKeys).toEqual(["modeThreads", "promptPresets"]);
  });

  it("keeps mode messages and choice history intact while planning inactive-branch updates", () => {
    const initial = snapshot();
    const thread = initial.modeThreads[0]! as MessengerModeThread;
    const inactive = { ...thread.branches[0], id: "inactive", presetId: deletedPreset.id };
    const withInactive = {
      ...initial,
      modeThreads: [
        {
          ...thread,
          branches: [thread.branches[0]!, inactive] as [
            (typeof thread.branches)[number],
            typeof inactive,
          ],
        },
        initial.modeThreads[1]!,
      ],
    };
    const plan = planPromptPresetDeletion(withInactive, deletedPreset.id, "2026-01-02");
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.snapshot.modeThreads.flatMap((item) => item.messages)).toEqual(
      withInactive.modeThreads.flatMap((item) => item.messages),
    );
    expect(
      plan.snapshot.modeThreads[0]?.branches.every((branch) => branch.presetId === preset.id),
    ).toBe(true);
    expect(plan.snapshot.modeThreads[0]?.branches[0]?.presetChoiceSelectionsByPresetId).toEqual(
      withInactive.modeThreads[0]?.branches[0]?.presetChoiceSelectionsByPresetId,
    );
  });
});
