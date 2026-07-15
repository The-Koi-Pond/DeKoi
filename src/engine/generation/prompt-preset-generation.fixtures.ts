import { createCharacterRecord } from "../catalog/character-actions";
import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import { createProviderConnectionRecord } from "../catalog/provider-connection-actions";
import type { ModeMessage, RoleplayModeThread } from "../contracts/types/mode-thread";
import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../contracts/types/prompt-presets";
import type { ProviderConnectionProvider } from "../contracts/types/provider-connection";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";
import { createRoleplayThread as createRoleplayModeThread } from "../modes/roleplay/roleplay-actions";
export const now = "2026-07-08T00:00:00.000Z";

export const createRoleplayThread = (
  input: Omit<Parameters<typeof createRoleplayModeThread>[0], "openingCharacter" | "branchId"> & {
    openingCharacter?: Parameters<typeof createRoleplayModeThread>[0]["openingCharacter"];
    messages?: ModeMessage[];
    presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
  },
): RoleplayModeThread => {
  const { messages = [], presetChoiceSelectionsByPresetId, ...creationInput } = input;
  const thread = createRoleplayModeThread({
    openingCharacter: null,
    branchId: `${creationInput.id}-branch`,
    ...creationInput,
  });
  const withMessages = messages.length ? { ...thread, messages } : thread;
  return presetChoiceSelectionsByPresetId
    ? {
        ...withMessages,
        branches: [
          { ...withMessages.branches[0], presetChoiceSelectionsByPresetId },
          ...withMessages.branches.slice(1),
        ],
      }
    : withMessages;
};

export function companion() {
  return createCharacterRecord({
    id: "character-1",
    input: {
      displayName: "Mara",
      description: "A careful pilot.",
    },
    now,
  });
}

export function providerConnection(provider: ProviderConnectionProvider = "openai") {
  return createProviderConnectionRecord({
    id: "connection-1",
    input: {
      label: "Test provider",
      provider,
      baseUrl: "https://example.test/v1",
      model: "test-model",
      hasSecret: true,
      maxOutput: 2048,
    },
    now,
  });
}

export function lorebookWithSummary() {
  return {
    ...createLorebookRecord({
      id: "lorebook-1",
      input: {
        title: "Station Manual",
        summary: "Docking safety summary.",
      },
      now,
    }),
    entries: [
      createLorebookEntryRecord({
        id: "lore-entry-1",
        input: {
          title: "Airlock rule",
          body: "Cycle slowly.",
          strategy: "constant",
          insertionPosition: "after-character",
        },
        now,
      }),
    ],
  };
}

export function lorebookWithSplitEntries(beforeBody = "Check suit seals.") {
  return {
    ...createLorebookRecord({
      id: "lorebook-1",
      input: {
        title: "Station Manual",
        summary: "Docking safety summary.",
      },
      now,
    }),
    entries: [
      createLorebookEntryRecord({
        id: "lore-entry-before",
        input: {
          title: "Before rule",
          body: beforeBody,
          strategy: "constant",
          insertionPosition: "before-character",
        },
        now,
      }),
      createLorebookEntryRecord({
        id: "lore-entry-after",
        input: {
          title: "After rule",
          body: "Cycle slowly.",
          strategy: "constant",
          insertionPosition: "after-character",
        },
        now,
      }),
    ],
  };
}

export function promptPreset(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Preset One",
    summary: null,
    systemPrompt: "Preset prompt for {{char}}.",
    messengerPrompt: null,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

export function roleplayEntry(id: string, body: string): ModeMessage {
  return createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: "roleplay-thread-1",
    branchId: "roleplay-thread-1-branch",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body,
    origin: "manual",
    now,
  });
}
