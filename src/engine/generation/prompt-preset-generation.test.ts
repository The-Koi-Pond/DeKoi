import { describe, expect, it } from "vitest";

import { createCharacterRecord } from "../catalog/character-actions";
import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import { createProviderConnectionRecord } from "../catalog/provider-connection-actions";
import type {
  MessengerModeThread,
  ModeMessage,
  RoleplayModeThread,
} from "../contracts/types/mode-thread";
import type {
  PromptPresetRecord,
  PromptPresetThreadChoiceSelections,
} from "../contracts/types/prompt-presets";
import type { ProviderConnectionProvider } from "../contracts/types/provider-connection";
import { createMessengerThread as createMessengerModeThread } from "../modes/messenger/messenger-actions";
import { createRoleplayThread as createRoleplayModeThread } from "../modes/roleplay/roleplay-actions";
import { STARTER_PROMPT_PRESET } from "../prompt-presets/starter-preset";
import {
  createMessengerGenerationContext as createMessengerGenerationContextRaw,
  createMessengerGenerationRequestAssembly as createMessengerGenerationRequestAssemblyRaw,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext as createRoleplayGenerationContextRaw,
  createRoleplayGenerationRequestAssembly as createRoleplayGenerationRequestAssemblyRaw,
} from "./roleplay-generation";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";

const now = "2026-07-08T00:00:00.000Z";
const createMessengerThread = (
  input: Omit<Parameters<typeof createMessengerModeThread>[0], "branchId"> & {
    messages?: ModeMessage[];
    presetChoiceSelectionsByPresetId?: Record<string, PromptPresetThreadChoiceSelections>;
  },
): MessengerModeThread => {
  const { messages = [], presetChoiceSelectionsByPresetId, ...creationInput } = input;
  const thread = createMessengerModeThread({
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
const createRoleplayThread = (
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
const createMessengerGenerationContext = (
  input: Parameters<typeof createMessengerGenerationContextRaw>[0],
) => createMessengerGenerationContextRaw(input);
const createRoleplayGenerationContext = (
  input: Parameters<typeof createRoleplayGenerationContextRaw>[0],
) => createRoleplayGenerationContextRaw(input);
const createMessengerGenerationRequestAssembly = (
  input: Parameters<typeof createMessengerGenerationRequestAssemblyRaw>[0],
) =>
  createMessengerGenerationRequestAssemblyRaw({
    ...input,
    context: {
      ...input.context,
      requestThread: {
        ...input.context.requestThread,
        messages: input.context.requestThread.messages.some(
          (message) => message.id === input.userMessage.id,
        )
          ? input.context.requestThread.messages
          : [...input.context.requestThread.messages, input.userMessage],
      },
    },
  });
const createRoleplayGenerationRequestAssembly = (
  input: Parameters<typeof createRoleplayGenerationRequestAssemblyRaw>[0],
) => createRoleplayGenerationRequestAssemblyRaw(input);

function companion() {
  return createCharacterRecord({
    id: "character-1",
    input: {
      displayName: "Mara",
      description: "A careful pilot.",
    },
    now,
  });
}

function providerConnection(provider: ProviderConnectionProvider = "openai") {
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

function lorebookWithSummary() {
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

function lorebookWithSplitEntries() {
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
          body: "Check suit seals.",
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

function lorebookWithMacroSplitEntries() {
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
          body: "{{setvar::loreFlag::seen}}Check suit seals.",
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

function promptPreset(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Preset One",
    summary: null,
    systemPrompt: "Preset prompt for {{char}}.",
    messengerPrompt: null,
    sampling: null,
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

function roleplayEntry(id: string, body: string): ModeMessage {
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

function userMessage(thread: MessengerModeThread): ModeMessage {
  return createModeMessage({
    id: "message-1",
    versionId: "message-1-v1",
    threadId: thread.id,
    branchId: thread.activeBranchId,
    author: { kind: "unknown", label: "Alex" },
    body: "Hello.",
    origin: "manual",
    now,
  });
}

describe("prompt preset generation", () => {
  it("keeps neutral Roleplay scene entries as system messages", () => {
    const sceneEntry = createModeMessage({
      id: "scene-1",
      versionId: "scene-1-v1",
      threadId: "roleplay-thread-1",
      branchId: "roleplay-thread-1-branch",
      author: { kind: "system", label: "Scene" },
      body: "The room goes quiet.",
      origin: "manual",
      now,
    });
    const system = createModeMessage({
      id: "system-1",
      versionId: "system-1-v1",
      threadId: "roleplay-thread-1",
      branchId: "roleplay-thread-1-branch",
      author: { kind: "system", label: "System" },
      body: "Keep this instruction active.",
      origin: "manual",
      now,
    });
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-thread-1",
      messages: [sceneEntry, system],
      now,
      title: "Test scene",
    });
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      thread,
    });
    const transcript = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    }).request.promptMessages;

    expect(transcript).toContainEqual({ role: "system", content: "Scene: The room goes quiet." });
    expect(transcript).toContainEqual({
      role: "system",
      content: "System: Keep this instruction active.",
    });
  });

  it("uses a selected Messenger preset as the system prompt base", () => {
    const thread: MessengerModeThread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        providerConnectionId: "connection-1",
        title: "Test chat",
        defaultPromptPresetId: "preset-1",
      }),
    };
    const preset = promptPreset({
      systemPrompt: "Roleplay-only preset for {{char}}.",
      messengerPrompt: "Messenger preset for {{char}}.",
      sampling: {
        maxTokens: 8192,
        temperature: 1.2,
        topP: 0.7,
      },
    });
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [preset],
      providerConnections: [providerConnection()],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      parameters: {
        maxTokens: 256,
        temperature: 0.4,
        topP: 0.9,
      },
      userMessage: userMessage(thread),
    });

    expect(assembly.request.thread.branches[0]?.presetId).toBe("preset-1");
    expect(assembly.request.promptMessages[0]?.content).toContain("Messenger preset for Mara.");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Roleplay-only preset");
    expect(assembly.request.parameters).toEqual({
      maxTokens: 2048,
      temperature: 1.2,
      topP: 0.7,
    });
  });

  it("uses the selected Messenger preset system prompt instead of legacy conversation fields", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        title: "Test chat",
        defaultPromptPresetId: "preset-1",
      }),
    };
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Roleplay-only preset for {{char}}.",
          messengerPrompt: "Messenger prompt for {{char}}.",
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Section prompt for {{char}}.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
          ],
        }),
      ],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    });

    expect(assembly.request.promptMessages[0]?.content).toContain("Messenger prompt for Mara.");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Roleplay-only preset");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Section prompt");
  });

  it("preserves a native custom Messenger prompt over the selected preset", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-thread-1",
      now,
      title: "Test chat",
      defaultPromptPresetId: "preset-1",
      systemPrompt: "Legacy custom prompt for {{char}}.",
      systemPromptMode: "custom",
    });
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset()],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    });

    expect(assembly.request.promptMessages[0]?.content).toContain("Legacy custom prompt for Mara.");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Preset prompt for Mara.");
    expect(assembly.request.thread.branches[0]?.presetId).toBe("preset-1");
  });

  it("falls back to the default Messenger prompt when the selected preset is missing", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        title: "Test chat",
        defaultPromptPresetId: "missing-preset",
      }),
    };
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    });

    expect(assembly.request.thread.branches[0]?.presetId).toBeNull();
    expect(assembly.request.warnings).toContain(
      "Messenger thread references a missing prompt preset: missing-preset.",
    );
    expect(assembly.request.promptMessages[0]?.content).toContain(
      "texting privately with the user in a casual DM conversation",
    );
  });

  it("projects only the resolved Messenger preset choice history into the request envelope", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-thread-1",
      now,
      title: "Test chat",
      defaultPromptPresetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": { active: { kind: "option", optionId: "selected" } },
        "preset-inactive": { poison: { kind: "option", optionId: "POISON" } },
      },
    });
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset()],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    });
    const branch = assembly.request.thread.branches[0];

    expect(branch.presetChoiceSelectionsByPresetId).toEqual({
      "preset-1": { active: { kind: "option", optionId: "selected" } },
    });
    expect(JSON.stringify(assembly.request)).not.toContain("POISON");
  });

  it("projects only the resolved Roleplay preset choice history into the request envelope", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-thread-1",
      now,
      title: "Test scene",
      defaultPromptPresetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": { active: { kind: "option", optionId: "selected" } },
        "preset-inactive": { poison: { kind: "option", optionId: "POISON" } },
      },
    });
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset()],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const branch = assembly.request.thread.branches[0];

    expect(branch.presetChoiceSelectionsByPresetId).toEqual({
      "preset-1": { active: { kind: "option", optionId: "selected" } },
    });
    expect(JSON.stringify(assembly.request)).not.toContain("POISON");
  });

  it("projects only the active branch and active message versions into the request", () => {
    const base = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-thread-1",
      now,
      title: "Test chat",
    });
    const activeBranch = base.branches[0];
    const siblingBranch = { ...activeBranch, id: "sibling-branch", updatedAt: now };
    const message = createModeMessage({
      id: "message-1",
      versionId: "active-version",
      threadId: base.id,
      branchId: activeBranch.id,
      author: { kind: "persona", personaId: "persona-1", label: "Alex" },
      body: "Active message.",
      origin: "manual",
      now,
    });
    message.versions.push({ ...message.versions[0], id: "inactive-version", body: "POISON" });
    const thread: MessengerModeThread = {
      ...base,
      branches: [activeBranch, siblingBranch],
      messages: [message],
    };
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      thread,
    });
    const request = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    }).request;

    expect(request.thread.branches).toHaveLength(1);
    expect(request.thread.branches[0]?.id).toBe(activeBranch.id);
    const projectedMessage = request.thread.messages.find((item) => item.id === message.id);
    expect(projectedMessage?.versions).toHaveLength(1);
    expect(projectedMessage?.versions[0]?.body).toBe("Active message.");
    expect(JSON.stringify(request.thread)).not.toContain("POISON");
    expect(request.thread).not.toHaveProperty("sceneText");
    expect(request.thread).not.toHaveProperty("narrator");
  });

  it("uses a selected Roleplay preset as the system prelude", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset({ systemPrompt: "Roleplay preset for {{char}}." })],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });

    expect(assembly.request.thread.branches[0]?.presetId).toBe("preset-1");
    expect(assembly.request.promptMessages[0]?.content).toContain("Roleplay preset for Mara.");
  });

  it("uses branch custom system prompts ahead of selected preset prompts in both modes", () => {
    const messengerThread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-custom-prompt",
      now,
      title: "Custom Messenger",
      defaultPromptPresetId: "preset-1",
      systemPromptMode: "custom",
      systemPrompt: "Messenger custom prompt for {{char}}.",
    });
    const messengerAssembly = createMessengerGenerationRequestAssembly({
      context: createMessengerGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [promptPreset({ messengerPrompt: "Preset Messenger prompt." })],
        thread: messengerThread,
      }),
      id: "messenger-custom-request",
      now,
      userMessage: userMessage(messengerThread),
    });
    expect(messengerAssembly.request.promptMessages[0]?.content).toContain(
      "Messenger custom prompt for Mara.",
    );
    expect(messengerAssembly.request.promptMessages[0]?.content).not.toContain(
      "Preset Messenger prompt.",
    );

    const roleplayThread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-custom-prompt",
      now,
      title: "Custom Roleplay",
      defaultPromptPresetId: "preset-1",
      systemPromptMode: "custom",
      systemPrompt: "Roleplay custom prompt for {{char}}.",
    });
    const roleplayAssembly = createRoleplayGenerationRequestAssembly({
      context: createRoleplayGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [promptPreset({ systemPrompt: "Preset Roleplay prompt." })],
        thread: roleplayThread,
      }),
      id: "roleplay-custom-request",
      now,
    });
    expect(roleplayAssembly.request.promptMessages[0]?.content).toContain(
      "Roleplay custom prompt for Mara.",
    );
    expect(roleplayAssembly.request.promptMessages[0]?.content).not.toContain(
      "Preset Roleplay prompt.",
    );
  });

  it("resolves selected prompt preset choice variables without dynamic macro state", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        title: "Test chat",
        defaultPromptPresetId: "preset-1",
        presetChoiceSelectionsByPresetId: {
          "preset-1": {
            "choice-pacing": { kind: "option" as const, optionId: "slow" },
          },
        },
      }),
    };
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Use {{pacing}} and {{getvar::tone}}.",
          messengerPrompt: "Legacy Messenger prompt {{pacing}}.",
          choiceBlocks: [
            {
              id: "choice-pacing",
              variableName: "pacing",
              label: "Pacing",
              defaultOptionId: "fast",
              options: [
                { id: "fast", label: "Fast", value: "fast pacing" },
                { id: "slow", label: "Slow", value: "slow pacing" },
              ],
            },
            {
              id: "choice-tone",
              variableName: "tone",
              label: "Tone",
              defaultOptionId: "warm",
              options: [
                {
                  id: "warm",
                  label: "Warm",
                  value: "{{setvar::mood::bad}}warm tone",
                },
              ],
            },
          ],
        }),
      ],
      thread,
      variables: {
        pacing: "stored pacing",
      },
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread),
    });

    expect(assembly.request.promptMessages[0]?.content).toContain(
      "Legacy Messenger prompt slow pacing.",
    );
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Use slow pacing");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("stored pacing");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("bad");
    expect(assembly.macroVariableMutations).toEqual([]);
    expect(context.ephemeralVariableNames).toEqual(["pacing", "tone"]);
  });

  it("resolves selected and default prompt preset choices for Roleplay generation", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
        presetChoiceSelectionsByPresetId: {
          "preset-1": {
            "choice-pacing": { kind: "option" as const, optionId: "slow" },
          },
        },
      }),
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Use {{pacing}} and {{tone}}.",
          choiceBlocks: [
            {
              id: "choice-pacing",
              variableName: "pacing",
              label: "Pacing",
              defaultOptionId: "fast",
              options: [
                { id: "fast", label: "Fast", value: "fast pacing" },
                { id: "slow", label: "Slow", value: "slow pacing" },
              ],
            },
            {
              id: "choice-tone",
              variableName: "tone",
              label: "Tone",
              defaultOptionId: "warm",
              options: [{ id: "warm", label: "Warm", value: "warm tone" }],
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain("Use slow pacing and warm tone.");
    expect(promptText).not.toContain("fast pacing");
  });

  it("preserves preset-controlled Roleplay output while protecting user agency", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt:
            "Roleplay preset for {{char}}. Write the whole scene beat and include unknown relevant non-user character.",
        }),
      ],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain(
      "Roleplay preset for Mara. Write the whole scene beat and include unknown relevant non-user character.",
    );
    expect(promptText).toContain("Continue the scene with Mara as the primary character.");
    expect(promptText).toContain(
      "Never write the user's dialogue, intent, decisions, or deliberate actions.",
    );
    expect(promptText).toContain(
      "Follow the selected preset's output behavior for narration and other characters.",
    );
    expect(promptText).not.toContain("Write only Mara's next turn as one character entry.");
  });

  it("preserves the single-character Roleplay contract without a selected preset", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-thread-1",
      now,
      title: "Test scene",
    });
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain("Continue the scene as Mara.");
    expect(promptText).toContain(
      "Write only Mara's next turn as one character entry. Do not write the user's dialogue, intent, decisions, deliberate actions, response, narrator text, scene-beat text, or other characters' lines.",
    );
    expect(promptText).not.toContain("selected preset");
    expect(promptText).not.toContain("Continue the scene with Mara as the primary character.");
  });

  it("assembles prompt preset sections around the chat history marker", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role", "section-history", "section-role", "section-output"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role for {{char}}.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-output",
              identifier: "output",
              name: "Output",
              content: "Structured output instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
          ],
        }),
      ],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });

    expect(assembly.request.promptMessages.map((message) => message.content)).toEqual([
      "<role>\n    Structured role for Mara.\n</role>",
      "Alex: Open the airlock.",
      "<output>\n    Structured output instruction.\n</output>",
      "Continue the scene with Mara as the primary character.\nNever write the user's dialogue, intent, decisions, or deliberate actions.\nFollow the selected preset's output behavior for narration and other characters.\nDo not include metadata, markdown fences, or out-of-world notes.",
    ]);
  });

  it("omits Roleplay transcript when structured sections have no chat history marker", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role for {{char}}.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain("Structured role for Mara.");
    expect(promptText).not.toContain("Alex: Open the airlock.");
  });

  it("does not re-add Roleplay transcript when structured sections render empty", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt for {{char}}.",
          sectionOrder: ["section-role"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "   ",
              role: "system",
              enabled: true,
              isMarker: false,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain("Fallback prompt for Mara.");
    expect(promptText).not.toContain("Alex: Open the airlock.");
  });

  it("anchors depth-injected prompt preset sections to the chat history marker", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role", "section-history", "section-output", "section-depth"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-output",
              identifier: "output",
              name: "Output",
              content: "Structured output instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-depth",
              identifier: "depth",
              name: "Depth Instruction",
              content: "Depth instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
              injectionPosition: "depth",
              injectionDepth: 0,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptMessages = assembly.request.promptMessages.map((message) => message.content);

    expect(promptMessages.indexOf("Alex: Open the airlock.")).toBeLessThan(
      promptMessages.findIndex((content) => content.includes("Depth instruction.")),
    );
    expect(
      promptMessages.findIndex((content) => content.includes("Depth instruction.")),
    ).toBeLessThan(
      promptMessages.findIndex((content) => content.includes("Structured output instruction.")),
    );
  });

  it("resolves depth-injected prompt preset section macros in final message order", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role", "section-history", "section-output", "section-depth"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "{{setvar::phase::role}}Structured role.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-output",
              identifier: "output",
              name: "Output",
              content: "Output sees {{getvar::phase}}.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-depth",
              identifier: "depth",
              name: "Depth Instruction",
              content: "{{setvar::phase::depth}}Depth instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
              injectionPosition: "depth",
              injectionDepth: 0,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages.map((message) => message.content).join("\n");

    expect(promptText).toContain("Depth instruction.");
    expect(promptText).toContain("Output sees depth.");
    expect(assembly.macroVariableMutations).toEqual([
      {
        kind: "set",
        name: "phase",
        value: "role",
      },
      {
        kind: "set",
        name: "phase",
        value: "depth",
      },
    ]);
  });

  it("defaults missing prompt preset depth to zero", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role", "section-history", "section-output", "section-depth"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-output",
              identifier: "output",
              name: "Output",
              content: "Structured output instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-depth",
              identifier: "depth",
              name: "Depth Instruction",
              content: "Depth instruction.",
              role: "system",
              enabled: true,
              isMarker: false,
              injectionPosition: "depth",
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptMessages = assembly.request.promptMessages.map((message) => message.content);

    expect(promptMessages.indexOf("Alex: Open the airlock.")).toBeLessThan(
      promptMessages.findIndex((content) => content.includes("Depth instruction.")),
    );
    expect(
      promptMessages.findIndex((content) => content.includes("Depth instruction.")),
    ).toBeLessThan(
      promptMessages.findIndex((content) => content.includes("Structured output instruction.")),
    );
  });

  it("does not resolve unused Roleplay prelude fields for sectioned presets", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "{{setvar::unusedTitle::bad}}Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "{{setvar::unusedSystem::bad}}Fallback prompt.",
          sectionOrder: ["section-role", "section-history"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages.map((message) => message.content).join("\n");

    expect(promptText).toContain("Structured role.");
    expect(promptText).not.toContain("Fallback prompt.");
    expect(promptText).not.toContain("Hidden scene.");
    expect(assembly.macroVariableMutations).toEqual([]);
  });

  it("renders lore summaries in prompt preset marker order", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        lorebookIds: ["lorebook-1"],
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [lorebookWithSummary()],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-lorebook", "section-history"],
          sections: [
            {
              id: "section-lorebook",
              identifier: "lorebook",
              name: "Lore",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });

    expect(assembly.request.promptMessages[0]?.content).toContain(
      "Station Manual: Docking safety summary.",
    );
    expect(assembly.request.promptMessages[0]?.content).toContain(
      "Station Manual / Airlock rule: Cycle slowly.",
    );
  });

  it("drops Roleplay lore when sectioned presets omit lore markers", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        lorebookIds: ["lorebook-1"],
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [lorebookWithSummary()],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-history"],
          sections: [
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages.map((message) => message.content).join("\n");

    expect(promptText).toContain("Alex: Open the airlock.");
    expect(promptText).not.toContain("Station Manual / Airlock rule");
  });

  it("splits Roleplay world info markers by insertion position", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        lorebookIds: ["lorebook-1"],
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [lorebookWithSplitEntries()],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-before", "section-after"],
          sections: [
            {
              id: "section-before",
              identifier: "world_info_before",
              name: "World Info Before",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
              xmlTagName: "legacy_before",
            },
            {
              id: "section-after",
              identifier: "world_info_after",
              name: "World Info After",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages.map((message) => message.content).join("\n");
    const beforeBlock = promptText.slice(
      promptText.indexOf("<world_info_before>"),
      promptText.indexOf("</world_info_before>"),
    );
    const afterBlock = promptText.slice(
      promptText.indexOf("<world_info_after>"),
      promptText.indexOf("</world_info_after>"),
    );

    expect(beforeBlock).toContain("Station Manual / Before rule: Check suit seals.");
    expect(beforeBlock).not.toContain("Cycle slowly.");
    expect(afterBlock).toContain("Station Manual / After rule: Cycle slowly.");
    expect(afterBlock).not.toContain("Check suit seals.");
    expect(promptText).not.toContain("legacy_before");
  });

  it("combines Roleplay lorebook marker world info before and after", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        lorebookIds: ["lorebook-1"],
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [lorebookWithSplitEntries()],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-lorebook"],
          sections: [
            {
              id: "section-lorebook",
              identifier: "lorebook",
              name: "Lore",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const loreMessage = assembly.request.promptMessages[0]?.content ?? "";

    expect(loreMessage).toContain("Station Manual / Before rule: Check suit seals.");
    expect(loreMessage).toContain("Station Manual / After rule: Cycle slowly.");
    expect(loreMessage.indexOf("Check suit seals.")).toBeLessThan(
      loreMessage.indexOf("Cycle slowly."),
    );
  });

  it("reuses Roleplay lore marker expansions for overlapping markers", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        lorebookIds: ["lorebook-1"],
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [lorebookWithMacroSplitEntries()],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-lorebook", "section-before"],
          sections: [
            {
              id: "section-lorebook",
              identifier: "lorebook",
              name: "Lore",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
            {
              id: "section-before",
              identifier: "world_info_before",
              name: "World Info Before",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages.map((message) => message.content).join("\n");

    expect(promptText.match(/Station Manual \/ Before rule: Check suit seals\./g)).toHaveLength(2);
    expect(assembly.macroVariableMutations).toEqual([
      {
        kind: "set",
        name: "loreFlag",
        value: "seen",
      },
    ]);
  });

  it.each(["anthropic", "google"] as const)(
    "keeps depth-inserted prompt preset sections in the %s message stream",
    (provider) => {
      const thread = {
        ...createRoleplayThread({
          activePersonaId: null,
          characterIds: ["character-1"],
          id: "roleplay-thread-1",
          now,
          providerConnectionId: "connection-1",
          title: "Test scene",
          defaultPromptPresetId: "preset-1",
        }),
        messages: [roleplayEntry("entry-1", "Open the airlock.")],
      };
      const context = createRoleplayGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [
          promptPreset({
            systemPrompt: "Fallback prompt.",
            sectionOrder: ["section-history", "section-depth"],
            sections: [
              {
                id: "section-history",
                identifier: "chat_history",
                name: "Chat History",
                content: "",
                role: "system",
                enabled: true,
                isMarker: true,
              },
              {
                id: "section-depth",
                identifier: "depth",
                name: "Depth Instruction",
                content: "Depth instruction.",
                role: "system",
                enabled: true,
                isMarker: false,
                injectionPosition: "depth",
                injectionDepth: 0,
              },
            ],
          }),
        ],
        providerConnections: [providerConnection(provider)],
        thread,
      });
      const assembly = createRoleplayGenerationRequestAssembly({
        context,
        id: "request-1",
        now,
      });
      const depthMessage = assembly.request.promptMessages.find((message) =>
        message.content.includes("Depth instruction."),
      );

      expect(depthMessage?.role).toBe("user");
    },
  );

  it.each(["anthropic", "google"] as const)(
    "keeps post-history system preset sections in the %s message stream",
    (provider) => {
      const thread = {
        ...createRoleplayThread({
          activePersonaId: null,
          characterIds: ["character-1"],
          id: "roleplay-thread-1",
          now,
          providerConnectionId: "connection-1",
          title: "Test scene",
          defaultPromptPresetId: "preset-1",
        }),
        messages: [roleplayEntry("entry-1", "Open the airlock.")],
      };
      const context = createRoleplayGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [
          promptPreset({
            systemPrompt: "Fallback prompt.",
            sectionOrder: ["section-role", "section-history", "section-output"],
            sections: [
              {
                id: "section-role",
                identifier: "role",
                name: "Role",
                content: "Structured role.",
                role: "system",
                enabled: true,
                isMarker: false,
              },
              {
                id: "section-history",
                identifier: "chat_history",
                name: "Chat History",
                content: "",
                role: "system",
                enabled: true,
                isMarker: true,
              },
              {
                id: "section-output",
                identifier: "output",
                name: "Output",
                content: "Post-history output rules.",
                role: "system",
                enabled: true,
                isMarker: false,
              },
            ],
          }),
        ],
        providerConnections: [providerConnection(provider)],
        thread,
      });
      const assembly = createRoleplayGenerationRequestAssembly({
        context,
        id: "request-1",
        now,
      });
      const outputMessage = assembly.request.promptMessages.find((message) =>
        message.content.includes("Post-history output rules."),
      );

      expect(assembly.request.promptMessages[0]?.role).toBe("system");
      expect(outputMessage?.role).toBe("user");
      expect(assembly.request.promptMessages.map((message) => message.content)).toEqual([
        "<role>\n    Structured role.\n</role>",
        "Alex: Open the airlock.",
        "<output>\n    Post-history output rules.\n</output>",
        "Continue the scene with Mara as the primary character.\nNever write the user's dialogue, intent, decisions, or deliberate actions.\nFollow the selected preset's output behavior for narration and other characters.\nDo not include metadata, markdown fences, or out-of-world notes.",
      ]);
    },
  );

  it("includes Roleplay post-history instructions in single-user prompt preset collapse", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: "preset-1",
      }),
      messages: [roleplayEntry("entry-1", "Open the airlock.")],
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          parameters: {
            singleUserMessage: true,
          },
          systemPrompt: "Fallback prompt.",
          sectionOrder: ["section-role", "section-history"],
          sections: [
            {
              id: "section-role",
              identifier: "role",
              name: "Role",
              content: "Structured role.",
              role: "system",
              enabled: true,
              isMarker: false,
            },
            {
              id: "section-history",
              identifier: "chat_history",
              name: "Chat History",
              content: "",
              role: "system",
              enabled: true,
              isMarker: true,
            },
          ],
        }),
      ],
      thread,
    });

    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });

    expect(assembly.request.promptMessages).toHaveLength(1);
    expect(assembly.request.promptMessages[0]?.role).toBe("user");
    expect(assembly.request.promptMessages[0]?.content).toContain("[SYSTEM]");
    expect(assembly.request.promptMessages[0]?.content).toContain("Structured role.");
    expect(assembly.request.promptMessages[0]?.content).toContain("Alex: Open the airlock.");
    expect(assembly.request.promptMessages[0]?.content).toContain(
      "Continue the scene with Mara as the primary character.",
    );
  });

  it.each(["anthropic", "google"] as const)(
    "preserves system labels during single-user collapse for %s",
    (provider) => {
      const thread = {
        ...createRoleplayThread({
          activePersonaId: null,
          characterIds: ["character-1"],
          id: "roleplay-thread-1",
          now,
          providerConnectionId: "connection-1",
          title: "Test scene",
          defaultPromptPresetId: "preset-1",
        }),
        messages: [roleplayEntry("entry-1", "Open the airlock.")],
      };
      const context = createRoleplayGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [
          promptPreset({
            parameters: {
              singleUserMessage: true,
            },
            systemPrompt: "Fallback prompt.",
            sectionOrder: ["section-role", "section-history", "section-depth", "section-output"],
            sections: [
              {
                id: "section-role",
                identifier: "role",
                name: "Role",
                content: "Structured role.",
                role: "system",
                enabled: true,
                isMarker: false,
              },
              {
                id: "section-history",
                identifier: "chat_history",
                name: "Chat History",
                content: "",
                role: "system",
                enabled: true,
                isMarker: true,
              },
              {
                id: "section-depth",
                identifier: "depth",
                name: "Depth Instruction",
                content: "Depth instruction.",
                role: "system",
                enabled: true,
                isMarker: false,
                injectionPosition: "depth",
              },
              {
                id: "section-output",
                identifier: "output",
                name: "Output",
                content: "Post-history output rules.",
                role: "system",
                enabled: true,
                isMarker: false,
              },
            ],
          }),
        ],
        providerConnections: [providerConnection(provider)],
        thread,
      });

      const assembly = createRoleplayGenerationRequestAssembly({
        context,
        id: "request-1",
        now,
      });
      const prompt = assembly.request.promptMessages[0]?.content ?? "";

      expect(assembly.request.promptMessages).toHaveLength(1);
      expect(prompt).toContain("[SYSTEM]\n<role>");
      expect(prompt).toContain("[SYSTEM]\n<depth_instruction>");
      expect(prompt).toContain("[SYSTEM]\n<output>");
    },
  );

  it("keeps the starter preset compatible with Roleplay character entries", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
        defaultPromptPresetId: STARTER_PROMPT_PRESET.id,
      }),
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [STARTER_PROMPT_PRESET],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const promptText = assembly.request.promptMessages
      .map((message) => message.content)
      .join("\n\n");

    expect(promptText).toContain("Continue the scene with Mara as the primary character.");
    expect(promptText).toContain(
      "Never write the user's dialogue, intent, decisions, or deliberate actions.",
    );
    expect(promptText).toContain(
      "Follow the selected preset's output behavior for narration and other characters.",
    );
  });
});
