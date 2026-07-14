import { describe, expect, it } from "vitest";
import { normalizeMessengerThreadWithMetadata } from "./messenger-storage";

describe("Messenger storage normalization", () => {
  it("drops legacy conversation prompt overrides while preserving native state", () => {
    const result = normalizeMessengerThreadWithMetadata({
      id: "thread-1",
      schemaVersion: 1,
      kind: "messenger",
      mode: "direct",
      title: "Chat",
      characterIds: [],
      activePersonaId: null,
      lorebookIds: [],
      presetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": { "block-1": { kind: "option", optionId: "option-1" } },
      },
      providerConnectionId: null,
      systemPromptMode: "custom",
      systemPrompt: "Legacy override",
      messages: [
        {
          id: "message-1",
          schemaVersion: 1,
          threadId: "thread-1",
          author: { kind: "unknown", label: "You" },
          body: "Hi",
          origin: "manual",
          createdAt: "now",
          updatedAt: "now",
        },
      ],
      createdAt: "now",
      updatedAt: "now",
    });

    expect(result?.thread).not.toHaveProperty("systemPromptMode");
    expect(result?.thread).not.toHaveProperty("systemPrompt");
    expect(result?.normalizationChanged).toBe(true);
    expect(result?.thread.presetId).toBe("preset-1");
    expect(result?.thread.presetChoiceSelectionsByPresetId).toEqual({
      "preset-1": { "block-1": { kind: "option", optionId: "option-1" } },
    });
    expect(result?.thread.messages[0]?.body).toBe("Hi");
  });
});
