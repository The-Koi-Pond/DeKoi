import { describe, expect, it } from "vitest";

import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
} from "./roleplay-generation";
import {
  companion,
  createRoleplayThread,
  lorebookWithSplitEntries,
  lorebookWithSummary,
  now,
  promptPreset,
  roleplayEntry,
} from "./prompt-preset-generation.fixtures";

describe("structured Roleplay prompt preset lore markers", () => {
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
      lorebooks: [lorebookWithSplitEntries("{{setvar::loreFlag::seen}}Check suit seals.")],
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
});
