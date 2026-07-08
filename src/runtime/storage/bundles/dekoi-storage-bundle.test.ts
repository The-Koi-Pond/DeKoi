import { describe, expect, it } from "vitest";

import {
  DEKOI_STORAGE_BUNDLE_KIND,
  DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
  createDeKoiStorageBundle,
  normalizeDeKoiStorageBundle,
} from "./dekoi-storage-bundle";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { createRoleplayThread } from "../../../engine/modes/roleplay/roleplay-actions";
import { createPersonaRecord } from "../../../engine/catalog/persona-actions";
import { STARTER_PROMPT_PRESET } from "../../../engine/prompt-presets/starter-preset";

const now = "2026-06-24T07:00:00.000Z";

describe("normalizeDeKoiStorageBundle", () => {
  it("reports lorebook schemaVersion 2 when rejecting pre-v2 records", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: "2026-06-24T07:00:00.000Z",
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [
          {
            id: "pre-v2-lorebook",
            schemaVersion: 1,
            title: "Pre-v2 Lorebook",
            summary: "",
            entries: [],
          },
        ],
        promptPresets: [],
        loreRuntimeStates: [],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.warnings).toContain(
      "Lorebooks did not contain valid schema version 2 records.",
    );
    expect(result.preview.warnings).not.toContain(
      "Lorebooks did not contain valid schema version 1 records.",
    );
  });

  it("imports missing lore runtime states as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.loreRuntimeStates).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Lore runtime states was missing or not an array; imported as empty.",
    );
  });

  it("imports missing prompt presets as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        loreRuntimeStates: [],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.promptPresets).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Prompt presets was missing or not an array; imported as empty.",
    );
  });

  it("imports packaged prompt presets as native DeKoi records", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [
          {
            type: "dekoi_preset",
            version: 1,
            exportedAt: now,
            data: {
              preset: {
                id: "preset-standard",
                name: "Standard Preset",
                description: "Portable preset",
                sectionOrder: ["section-role", "section-history", "section-output"],
                groupOrder: ["group-context"],
                variableOrder: ["choice-tone"],
                variableGroups: [],
                variableValues: { tone: "warm" },
                defaultChoices: { tone: "warm prose" },
                parameters: {
                  temperature: 1,
                  topP: 0.9,
                  topK: 40,
                  maxTokens: 2048,
                  maxContext: 16000,
                  strictRoleFormatting: true,
                  stopSequences: ["STOP"],
                },
                conversationPrompt: "Conversation prompt.",
                isDefault: true,
                author: "Koi",
                folderId: null,
                createdAt: now,
                updatedAt: now,
              },
              groups: [
                {
                  id: "group-context",
                  presetId: "preset-standard",
                  name: "Context",
                  order: 100,
                  enabled: true,
                  createdAt: now,
                },
              ],
              sections: [
                {
                  id: "section-role",
                  presetId: "preset-standard",
                  identifier: "role",
                  name: "Role",
                  content: "You are {{tone}}.",
                  role: "system",
                  enabled: true,
                  isMarker: false,
                  groupId: null,
                  markerConfig: null,
                  injectionOrder: 0,
                },
                {
                  id: "section-history",
                  presetId: "preset-standard",
                  identifier: "history",
                  name: "Chat History",
                  content: "",
                  role: "system",
                  enabled: true,
                  isMarker: true,
                  markerConfig: { type: "chat_history" },
                  injectionOrder: 1,
                },
                {
                  id: "section-output",
                  presetId: "preset-standard",
                  identifier: "output",
                  name: "Output",
                  content: "Write the next reply.",
                  role: "system",
                  enabled: true,
                  isMarker: false,
                  injectionOrder: 2,
                },
              ],
              choiceBlocks: [
                {
                  id: "choice-tone",
                  presetId: "preset-standard",
                  variableName: "tone",
                  question: "Choose tone.",
                  options: [
                    {
                      id: "tone-warm",
                      label: "Warm",
                      value: "warm prose",
                      description: "Gentle phrasing",
                    },
                    { id: "tone-cold", label: "Cold", value: "cold prose" },
                  ],
                  multiSelect: false,
                  separator: ", ",
                  randomPick: false,
                  sortOrder: 10,
                  createdAt: now,
                },
              ],
            },
          },
          {
            type: "marinara_preset",
            version: 1,
            exportedAt: now,
            data: {
              preset: {
                id: "preset-db-row",
                name: "DB Row Preset",
                description: "Portable preset",
                systemPrompt: "DB row prompt.",
                variableGroups: JSON.stringify([]),
                variableValues: JSON.stringify({ tone: "warm" }),
                defaultChoices: JSON.stringify({ motifs: ["rain on glass", "neon signs"] }),
                parameters: JSON.stringify({ temperature: 1, squashSystemMessages: true }),
                conversationPrompt: "Conversation prompt.",
                gamePrompt: "Game prompt.",
                isDefault: "true",
                author: "Koi",
                createdAt: now,
                updatedAt: now,
              },
              sections: [],
              groups: [],
              choiceBlocks: [
                {
                  id: "choice-motifs",
                  presetId: "preset-db-row",
                  variableName: "motifs",
                  question: "Choose motifs.",
                  options: JSON.stringify([
                    { id: "rain", label: "Rain", value: "rain on glass" },
                    { id: "neon", label: "Neon", value: "neon signs" },
                  ]),
                  multiSelect: "true",
                  separator: " / ",
                  randomPick: "false",
                  displayMode: "listbox",
                  optionSort: "manual",
                  createdAt: now,
                },
              ],
            },
          },
        ],
        loreRuntimeStates: [],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    const [standardPreset, dbRowPreset] = result.preview.bundle.data.promptPresets;
    expect(standardPreset).toMatchObject({
      id: "preset-standard",
      title: "Standard Preset",
      summary: "Portable preset",
      systemPrompt: "You are {{tone}}.\n\nWrite the next reply.",
      messengerPrompt: "Conversation prompt.",
      sampling: {
        maxTokens: 2048,
        temperature: 1,
        topP: 0.9,
      },
      parameters: {
        maxTokens: 2048,
        temperature: 1,
        topP: 0.9,
        topK: 40,
        maxContext: 16000,
        strictRoleFormatting: true,
        stopSequences: ["STOP"],
      },
      defaultChoices: { tone: "warm prose" },
      choiceBlocks: [
        expect.objectContaining({
          id: "choice-tone",
          label: "Choose tone.",
          defaultOptionId: "tone-warm",
        }),
      ],
    });
    expect(standardPreset).not.toHaveProperty("sourceType");
    expect(standardPreset).not.toHaveProperty("conversationPrompt");

    expect(dbRowPreset).toMatchObject({
      id: "preset-db-row",
      title: "DB Row Preset",
      systemPrompt: "DB row prompt.",
      messengerPrompt: "Conversation prompt.",
      variableValues: { tone: "warm" },
      defaultChoices: { motifs: ["rain on glass", "neon signs"] },
      parameters: { temperature: 1, squashSystemMessages: true },
      isDefault: true,
      choiceBlocks: [
        expect.objectContaining({
          multiSelect: true,
          displayMode: "listbox",
          options: [
            { id: "rain", label: "Rain", value: "rain on glass" },
            { id: "neon", label: "Neon", value: "neon signs" },
          ],
        }),
      ],
    });
    expect(dbRowPreset).not.toHaveProperty("sourceType");
    expect(dbRowPreset).not.toHaveProperty("gamePrompt");
  });

  it("clears imported thread preset IDs that do not resolve to valid prompt presets", () => {
    const messengerThreadWithValidPreset = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        id: "messenger-thread-valid",
        now,
        title: "Messenger valid",
      }),
      presetId: STARTER_PROMPT_PRESET.id,
    };
    const messengerThreadWithMissingPreset = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: [],
        id: "messenger-thread-missing",
        now,
        title: "Messenger missing",
      }),
      presetId: "skipped-preset",
    };
    const roleplayThreadWithMissingPreset = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: [],
        id: "roleplay-thread-missing",
        now,
        title: "Roleplay missing",
      }),
      presetId: "skipped-preset",
    };
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [roleplayThreadWithMissingPreset],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [STARTER_PROMPT_PRESET, { id: "skipped-preset" }],
        loreRuntimeStates: [],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [messengerThreadWithValidPreset, messengerThreadWithMissingPreset],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.promptPresets.map((preset) => preset.id)).toEqual([
      STARTER_PROMPT_PRESET.id,
    ]);
    expect(
      result.preview.bundle.data.messengerThreads.map((thread) => [thread.id, thread.presetId]),
    ).toEqual([
      ["messenger-thread-valid", STARTER_PROMPT_PRESET.id],
      ["messenger-thread-missing", null],
    ]);
    expect(
      result.preview.bundle.data.roleplayThreads.map((thread) => [thread.id, thread.presetId]),
    ).toEqual([["roleplay-thread-missing", null]]);
    expect(result.preview.warnings).toContain("Prompt presets skipped 1 invalid record(s).");
    expect(result.preview.warnings).toContain(
      "Messenger threads cleared 1 preset reference(s) without an imported prompt preset.",
    );
    expect(result.preview.warnings).toContain(
      "Roleplay threads cleared 1 preset reference(s) without an imported prompt preset.",
    );
  });

  it("skips lore runtime states whose owner thread is not imported", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: [],
      id: "messenger-thread-imported",
      now,
      title: "Imported",
    });
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [],
        loreRuntimeStates: [
          {
            id: "lore-runtime-state-imported",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "messenger-thread-imported",
            lastEvaluatedMessageCount: 3,
            entries: [],
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "lore-runtime-state-orphaned",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "missing-thread",
            lastEvaluatedMessageCount: 3,
            entries: [],
            createdAt: now,
            updatedAt: now,
          },
        ],
        macroVariableStates: [],
        providerConnections: [],
        messengerThreads: [thread],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.loreRuntimeStates.map((state) => state.id)).toEqual([
      "lore-runtime-state-imported",
    ]);
    expect(result.preview.warnings).toContain(
      "Lore runtime states skipped 1 record(s) without an imported owner.",
    );
  });

  it("imports missing macro variable states as empty for older storage bundles", () => {
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        loreRuntimeStates: [],
        providerConnections: [],
        messengerThreads: [],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.macroVariableStates).toEqual([]);
    expect(result.preview.warnings).not.toContain(
      "Macro variable states was missing or not an array; imported as empty.",
    );
  });

  it("skips orphaned thread macro variable states but keeps global state", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: [],
      id: "messenger-thread-imported",
      now,
      title: "Imported",
    });
    const result = normalizeDeKoiStorageBundle({
      kind: DEKOI_STORAGE_BUNDLE_KIND,
      schemaVersion: DEKOI_STORAGE_BUNDLE_SCHEMA_VERSION,
      exportedAt: now,
      data: {
        appSettings: {},
        characters: [],
        roleplayThreads: [],
        roleplayEntries: [],
        personas: [],
        lorebooks: [],
        promptPresets: [],
        loreRuntimeStates: [],
        macroVariableStates: [
          {
            id: "macro-variable-state-imported",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "messenger-thread-imported",
            variables: { mood: "calm" },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "macro-variable-state-orphaned",
            schemaVersion: 1,
            ownerKind: "messenger-thread",
            ownerId: "missing-thread",
            variables: { hidden: "yes" },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "macro-variable-state-global",
            schemaVersion: 1,
            ownerKind: "global",
            ownerId: "global",
            variables: { day: "Tuesday" },
            createdAt: now,
            updatedAt: now,
          },
        ],
        providerConnections: [],
        messengerThreads: [thread],
        messengerMessages: [],
        rippleStates: [],
      },
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.bundle.data.macroVariableStates.map((state) => state.id)).toEqual([
      "macro-variable-state-imported",
      "macro-variable-state-global",
    ]);
    expect(result.preview.counts.macroVariableStates).toBe(2);
    expect(result.preview.counts.macroVariables).toBe(2);
    expect(result.preview.warnings).toContain(
      "Macro variable states skipped 1 record(s) without an imported owner.",
    );
  });

  it("preserves persona lorebooks and global lore settings in native bundles", () => {
    const persona = createPersonaRecord({
      id: "persona-1",
      input: {
        displayName: "Alex",
        lorebookIds: ["persona-lore"],
      },
      now,
    });
    const bundle = createDeKoiStorageBundle({
      appSettings: {
        ...DEFAULT_APP_SETTINGS,
        globalLorebookIds: ["global-lore"],
        loreInsertionStrategy: "global-first",
      },
      characters: [],
      roleplayThreads: [],
      personas: [persona],
      lorebooks: [],
      promptPresets: [],
      loreRuntimeStates: [],
      macroVariableStates: [],
      providerConnections: [],
      messengerThreads: [],
      rippleStates: [],
    });
    const result = normalizeDeKoiStorageBundle(bundle);

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(bundle.data.personas[0]?.lorebookIds).toEqual(["persona-lore"]);
    expect(bundle.data.appSettings.globalLorebookIds).toEqual(["global-lore"]);
    expect(bundle.data.appSettings.loreInsertionStrategy).toBe("global-first");
    expect(result.preview.bundle.data.personas[0]?.lorebookIds).toEqual(["persona-lore"]);
    expect(result.preview.bundle.data.appSettings.globalLorebookIds).toEqual(["global-lore"]);
    expect(result.preview.bundle.data.appSettings.loreInsertionStrategy).toBe("global-first");
  });
});
