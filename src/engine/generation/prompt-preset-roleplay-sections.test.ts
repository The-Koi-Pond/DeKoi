import { describe, expect, it } from "vitest";

import { STARTER_PROMPT_PRESET } from "../prompt-presets/starter-preset";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
} from "./roleplay-generation";
import {
  companion,
  createRoleplayThread,
  now,
  promptPreset,
  roleplayEntry,
} from "./prompt-preset-generation.fixtures";

describe("structured Roleplay prompt preset generation", () => {
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

    expect(promptText).toContain("You are Mara, writing the next in-character turn");
    expect(promptText).not.toContain("Fallback prompt for Mara.");
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
