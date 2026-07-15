import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { MacroVariableThreadOwnerKind } from "../../../engine/macro-variables/macro-variable-actions";
import { generateMessengerThreadReply } from "./messenger-generation";
import { generateRoleplayThreadTurn } from "./roleplay-generation";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";
import {
  messengerMessage,
  messengerThread,
  roleplayMessage,
  roleplayThread,
  messengerBranchId,
  roleplayBranchId,
} from "./test-fixtures";

vi.mock("./provider-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./provider-generation")>();
  return {
    ...actual,
    generateWithConfiguredProvider: vi.fn(),
  };
});

const now = "2026-07-08T00:00:00.000Z";

let capturedRequest: ProviderGenerationRequest | null = null;

function companion() {
  return createCharacterRecord({
    id: "character-1",
    input: { displayName: "Mara" },
    now,
  });
}

function createId(prefix: string) {
  return `${prefix}-1`;
}

function promptPreset(): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Preset One",
    summary: null,
    systemPrompt: "Preset tone {{tone}} style {{style}}.",
    messengerPrompt: "Messenger tone {{tone}} style {{style}}.",
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {
      style: "preset crisp",
    },
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [
      {
        id: "choice-tone",
        presetId: "preset-1",
        variableName: "tone",
        label: "Tone",
        options: [
          { id: "calm", label: "Calm", value: "calm" },
          { id: "urgent", label: "Urgent", value: "urgent" },
        ],
        defaultOptionId: "calm",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function macroVariableStates(
  ownerId: string,
  ownerKind: MacroVariableThreadOwnerKind = "mode-branch",
): MacroVariableScope[] {
  return [
    {
      id: "macro-state-1",
      schemaVersion: 1,
      ownerKind,
      ownerId,
      variables: {
        style: "stored verbose",
        tone: "stored flat",
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function configuredMessengerThread(message: ReturnType<typeof messengerMessage>) {
  const thread = messengerThread(message);
  thread.branches[0].presetId = "preset-1";
  thread.branches[0].presetChoiceSelectionsByPresetId = {
    "preset-1": { "choice-tone": { kind: "option", optionId: "urgent" } },
  };
  return thread;
}
function configuredRoleplayThread(message: ReturnType<typeof roleplayMessage>) {
  const thread = roleplayThread(message);
  thread.branches[0].presetId = "preset-1";
  thread.branches[0].presetChoiceSelectionsByPresetId = {
    "preset-1": { "choice-tone": { kind: "option", optionId: "urgent" } },
  };
  return thread;
}

function requireCapturedRequest() {
  if (capturedRequest === null) {
    throw new Error("Expected provider generation to receive a request.");
  }
  return capturedRequest;
}

function assembledPromptText(request: ProviderGenerationRequest) {
  return request.promptMessages.map((message) => message.content).join("\n\n");
}

describe("prompt preset choice variables", () => {
  beforeEach(() => {
    capturedRequest = null;
    vi.mocked(generateWithConfiguredProvider).mockImplementation(
      async (request: ProviderGenerationRequest) => {
        capturedRequest = request;
        return {
          schemaVersion: 1,
          requestId: request.id,
          source: "provider-transport",
          createdAt: now,
          messages: request.targetCharacterId
            ? [{ characterId: request.targetCharacterId, body: "Generated." }]
            : [],
          warnings: [],
        };
      },
    );
  });

  it("applies Messenger preset choice selections over stored macro variables", async () => {
    const message = messengerMessage();
    await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      macroVariableStates: macroVariableStates(messengerBranchId),
      now,
      personas: [],
      promptPresets: [promptPreset()],
      providerConnections: [],
      thread: configuredMessengerThread(message),
      userMessage: message,
    });

    const promptText = assembledPromptText(requireCapturedRequest());
    expect(promptText).toContain("Messenger tone urgent style preset crisp.");
    expect(promptText).not.toContain("stored flat");
    expect(promptText).not.toContain("stored verbose");
  });

  it("applies Roleplay preset choice selections over stored macro variables", async () => {
    const entry = roleplayMessage();
    await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      macroVariableStates: macroVariableStates(roleplayBranchId),
      now,
      personas: [],
      promptPresets: [promptPreset()],
      providerConnections: [],
      thread: configuredRoleplayThread(entry),
    });

    const promptText = assembledPromptText(requireCapturedRequest());
    expect(promptText).toContain("Preset tone urgent style preset crisp.");
    expect(promptText).not.toContain("stored flat");
    expect(promptText).not.toContain("stored verbose");
  });
});
