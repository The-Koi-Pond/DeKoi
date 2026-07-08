import { describe, expect, it } from "vitest";

import { createCharacterRecord } from "../catalog/character-actions";
import { createProviderConnectionRecord } from "../catalog/provider-connection-actions";
import type { MessengerMessage } from "../contracts/types/messenger";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { createMessengerThread } from "../modes/messenger/messenger-actions";
import { createRoleplayThread } from "../modes/roleplay/roleplay-actions";
import { STARTER_PROMPT_PRESET } from "../prompt-presets/starter-preset";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequestAssembly,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
} from "./roleplay-generation";

const now = "2026-07-08T00:00:00.000Z";

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

function providerConnection() {
  return createProviderConnectionRecord({
    id: "connection-1",
    input: {
      label: "Test provider",
      provider: "openai",
      baseUrl: "https://example.test/v1",
      model: "test-model",
      hasSecret: true,
      maxOutput: 2048,
    },
    now,
  });
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

function userMessage(threadId: string): MessengerMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId,
    author: {
      kind: "unknown",
      label: "Alex",
    },
    body: "Hello.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

describe("prompt preset generation", () => {
  it("uses a selected Messenger preset as the system prompt base", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        providerConnectionId: "connection-1",
        title: "Test chat",
      }),
      presetId: "preset-1",
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
      userMessage: userMessage(thread.id),
    });

    expect(assembly.request.thread.presetId).toBe("preset-1");
    expect(assembly.request.promptMessages[0]?.content).toContain("Messenger preset for Mara.");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Roleplay-only preset");
    expect(assembly.request.parameters).toEqual({
      maxTokens: 2048,
      temperature: 1.2,
      topP: 0.7,
    });
  });

  it("uses a custom Messenger prompt over a selected Messenger preset", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        title: "Test chat",
      }),
      presetId: "preset-1",
      systemPrompt: "Custom prompt for {{char}}.",
      systemPromptMode: "custom" as const,
    };
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
      userMessage: userMessage(thread.id),
    });

    expect(assembly.request.promptMessages[0]?.content).toContain("Custom prompt for Mara.");
    expect(assembly.request.promptMessages[0]?.content).not.toContain("Preset prompt");
    expect(assembly.request.thread.presetId).toBe("preset-1");
  });

  it("falls back to the default Messenger prompt when the selected preset is missing", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-thread-1",
        now,
        title: "Test chat",
      }),
      presetId: "missing-preset",
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
      userMessage: userMessage(thread.id),
    });

    expect(assembly.request.thread.presetId).toBeNull();
    expect(assembly.request.warnings).toContain(
      "Messenger thread references a missing prompt preset: missing-preset.",
    );
    expect(assembly.request.promptMessages[0]?.content).toContain(
      "texting privately with the user in a casual DM conversation",
    );
  });

  it("uses a selected Roleplay preset as the system prelude", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
      }),
      presetId: "preset-1",
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

    expect(assembly.request.thread.presetId).toBe("preset-1");
    expect(assembly.request.promptMessages[0]?.content).toContain("Roleplay preset for Mara.");
  });

  it("constrains a selected Roleplay preset to target-character output", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
      }),
      presetId: "preset-1",
    };
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [
        promptPreset({
          systemPrompt:
            "Roleplay preset for {{char}}. Write the whole scene beat and include any relevant non-user character.",
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
      "Roleplay preset for Mara. Write the whole scene beat and include any relevant non-user character.",
    );
    expect(promptText).toContain("Continue the scene as Mara.");
    expect(promptText).toContain("Write only Mara's next turn as one character entry.");
    expect(promptText).toContain("Do not write the user's response");
    expect(promptText).toContain("narrator text, scene-beat text, or other characters' lines.");
  });

  it("keeps the starter preset compatible with Roleplay character entries", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-thread-1",
        now,
        title: "Test scene",
      }),
      presetId: STARTER_PROMPT_PRESET.id,
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

    expect(promptText).toContain("output only Mara's natural next response or action.");
    expect(promptText).toContain("Write only Mara's next turn as one character entry.");
    expect(promptText).not.toContain("Portray the world and every character");
    expect(promptText).not.toContain("multi-character exchanges");
  });
});
