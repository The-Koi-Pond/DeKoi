import { describe, expect, it } from "vitest";

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
  roleplayEntry,
} from "./prompt-preset-generation.fixtures";

describe("structured Roleplay prompt preset provider policy", () => {
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
});
