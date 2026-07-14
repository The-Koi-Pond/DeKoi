import { describe, expect, it } from "vitest";

import { createCharacterRecord } from "../catalog/character-actions";
import type { MessengerMessage } from "../contracts/types/messenger";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { createMessengerThread } from "../modes/messenger/messenger-actions";
import { createRoleplayThread } from "../modes/roleplay/roleplay-actions";
import { normalizePromptPresetImportRecord } from "../prompt-presets/prompt-preset-package";
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

function promptPreset(input: Partial<PromptPresetRecord> = {}): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Optional component preset",
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
    sections: [],
    groups: [],
    choiceBlocks: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  };
}

function roleplaySections(systemPrompt = "") {
  return promptPreset({
    systemPrompt,
    sectionOrder: ["section-role"],
    sections: [
      {
        id: "section-role",
        identifier: "role",
        name: "Role",
        content: "ROLEPLAY_SECTION_ONLY",
        role: "system",
        enabled: true,
        isMarker: false,
      },
    ],
  });
}

function selectedMessengerThread() {
  return {
    ...createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-thread-1",
      now,
      title: "Test chat",
    }),
    presetId: "preset-1",
  };
}

function selectedRoleplayThread() {
  return {
    ...createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-thread-1",
      now,
      title: "Test scene",
    }),
    presetId: "preset-1",
  };
}

function userMessage(threadId: string): MessengerMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId,
    author: { kind: "unknown", label: "Alex" },
    body: "Hello.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

function promptText(messages: readonly { content: string }[]) {
  return messages.map((message) => message.content).join("\n\n");
}

describe("optional prompt preset generation components", () => {
  it.each([
    {
      name: "Messenger-specific-only",
      preset: promptPreset({ messengerPrompt: "Messenger-only text for {{char}}." }),
      expected: "Messenger-only text for Mara.",
    },
    {
      name: "shared-prompt-only",
      preset: promptPreset({ systemPrompt: "Shared prompt for {{char}}." }),
      expected: "Shared prompt for Mara.",
    },
    {
      name: "Roleplay-sections-only",
      preset: roleplaySections(),
      expected: "texting privately with the user in a casual DM conversation",
    },
    {
      name: "wholly promptless",
      preset: promptPreset(),
      expected: "texting privately with the user in a casual DM conversation",
    },
  ])("resolves a selected $name preset for Messenger", ({ preset, expected }) => {
    const thread = selectedMessengerThread();
    const context = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [preset],
      thread,
    });
    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
      userMessage: userMessage(thread.id),
    });
    const text = promptText(assembly.request.promptMessages);

    expect(text).toContain(expected);
    expect(text).not.toContain("ROLEPLAY_SECTION_ONLY");
  });

  it.each([
    {
      name: "Messenger-specific-only",
      preset: promptPreset({ messengerPrompt: "MESSENGER_ONLY" }),
      expected: "You are Mara, writing the next in-character turn",
      excluded: "MESSENGER_ONLY",
    },
    {
      name: "shared-prompt-only",
      preset: promptPreset({ systemPrompt: "Shared Roleplay prompt for {{char}}." }),
      expected: "Shared Roleplay prompt for Mara.",
      excluded: "MESSENGER_ONLY",
    },
    {
      name: "Roleplay-sections-only",
      preset: roleplaySections(),
      expected: "ROLEPLAY_SECTION_ONLY",
      excluded: "MESSENGER_ONLY",
    },
    {
      name: "wholly promptless",
      preset: promptPreset(),
      expected: "You are Mara, writing the next in-character turn",
      excluded: "MESSENGER_ONLY",
    },
  ])(
    "resolves a selected $name preset for Roleplay with preset output behavior",
    ({ preset, expected, excluded }) => {
      const thread = selectedRoleplayThread();
      const context = createRoleplayGenerationContext({
        characters: [companion()],
        lorebooks: [],
        personas: [],
        promptPresets: [preset],
        thread,
      });
      const assembly = createRoleplayGenerationRequestAssembly({
        context,
        id: "request-1",
        now,
      });
      const text = promptText(assembly.request.promptMessages);

      expect(text).toContain(expected);
      expect(text).not.toContain(excluded);
      expect(text).toContain("Continue the scene with Mara as the primary character.");
      expect(text).toContain(
        "Follow the selected preset's output behavior for narration and other characters.",
      );
      expect(text).not.toContain("Write only Mara's next turn as one character entry.");
    },
  );

  it("prefers usable Roleplay sections over the shared prompt", () => {
    const thread = selectedRoleplayThread();
    const context = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [roleplaySections("SHARED_FALLBACK")],
      thread,
    });
    const assembly = createRoleplayGenerationRequestAssembly({
      context,
      id: "request-1",
      now,
    });
    const text = promptText(assembly.request.promptMessages);

    expect(text).toContain("ROLEPLAY_SECTION_ONLY");
    expect(text).not.toContain("SHARED_FALLBACK");
  });

  it("keeps a native sections-only package mode-safe after import normalization", () => {
    const importedPreset = normalizePromptPresetImportRecord({
      type: "dekoi_preset",
      version: 1,
      exportedAt: now,
      data: {
        preset: {
          id: "preset-1",
          name: "Native sections-only preset",
          systemPrompt: "",
          sectionOrder: ["section-role"],
          createdAt: now,
          updatedAt: now,
        },
        sections: [
          {
            id: "section-role",
            identifier: "role",
            name: "Role",
            content: "IMPORTED_ROLEPLAY_SECTION",
            role: "system",
            enabled: true,
            isMarker: false,
          },
        ],
        groups: [],
        choiceBlocks: [],
      },
    });
    if (!importedPreset) throw new Error("Expected the native prompt preset package to import.");

    const messengerThread = selectedMessengerThread();
    const messengerContext = createMessengerGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [importedPreset],
      thread: messengerThread,
    });
    const messengerAssembly = createMessengerGenerationRequestAssembly({
      context: messengerContext,
      id: "messenger-request-1",
      now,
      userMessage: userMessage(messengerThread.id),
    });
    const messengerText = promptText(messengerAssembly.request.promptMessages);

    expect(importedPreset.systemPrompt).toBe("");
    expect(messengerText).toContain("texting privately with the user in a casual DM conversation");
    expect(messengerText).not.toContain("IMPORTED_ROLEPLAY_SECTION");

    const roleplayThread = selectedRoleplayThread();
    const roleplayContext = createRoleplayGenerationContext({
      characters: [companion()],
      lorebooks: [],
      personas: [],
      promptPresets: [importedPreset],
      thread: roleplayThread,
    });
    const roleplayAssembly = createRoleplayGenerationRequestAssembly({
      context: roleplayContext,
      id: "roleplay-request-1",
      now,
    });
    const roleplayText = promptText(roleplayAssembly.request.promptMessages);

    expect(roleplayText).toContain("IMPORTED_ROLEPLAY_SECTION");
    expect(roleplayText).toContain(
      "Follow the selected preset's output behavior for narration and other characters.",
    );
    expect(roleplayText).not.toContain("Write only Mara's next turn as one character entry.");
  });
});
