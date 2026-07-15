import { describe, expect, it } from "vitest";

import type { MessengerModeThread, ModeMessage } from "../contracts/types/mode-thread";
import type { PromptPresetThreadChoiceSelections } from "../contracts/types/prompt-presets";
import { createMessengerThread as createMessengerModeThread } from "../modes/messenger/messenger-actions";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";
import {
  createMessengerGenerationContext as createMessengerGenerationContextRaw,
  createMessengerGenerationRequestAssembly as createMessengerGenerationRequestAssemblyRaw,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
} from "./roleplay-generation";
import {
  companion,
  createRoleplayThread,
  now,
  promptPreset,
  providerConnection,
} from "./prompt-preset-generation.fixtures";

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

const createMessengerGenerationContext = (
  input: Parameters<typeof createMessengerGenerationContextRaw>[0],
) => createMessengerGenerationContextRaw(input);

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
      parameters: {
        maxTokens: { send: true, value: 8192 },
        temperature: { send: true, value: 1.2 },
        topP: { send: true, value: 0.7 },
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
});
