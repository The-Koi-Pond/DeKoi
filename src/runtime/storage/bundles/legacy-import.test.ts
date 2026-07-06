import { describe, expect, it } from "vitest";

import { normalizeLegacyImport } from "./legacy-import";

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeLegacyImport", () => {
  it("converts legacy catalog and provider aliases into native records", () => {
    const result = normalizeLegacyImport({
      characters: [
        {
          id: "legacy-character",
          schemaVersion: 1,
          displayName: "Mara",
          shortName: "Mars",
          description: "",
          summary: "Brave and direct.",
          scenario: "",
          firstMessage: "",
          alternateGreetings: [],
          groupOnlyGreetings: [],
          exampleMessages: "",
          systemPrompt: "",
          postHistoryInstructions: "",
          creator: "",
          characterVersion: "",
          creatorNotes: "",
          tags: [],
          characterNote: "",
          characterNoteDepth: 4,
          characterNoteRole: "system",
          talkativeness: 50,
          avatarUrl: null,
          lorebookIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
      personas: [
        {
          id: "legacy-persona",
          schemaVersion: 1,
          displayName: "Alex",
          nickname: null,
          description: "",
          summary: "Careful and kind.",
          scenario: "",
          systemPrompt: "",
          postHistoryInstructions: "",
          creator: "",
          characterVersion: "",
          creatorNotes: "",
          tags: [],
          characterNote: "",
          characterNoteDepth: 4,
          characterNoteRole: "system",
          talkativeness: 50,
          avatarUrl: null,
          lorebookIds: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
      providerConnections: [
        {
          id: "legacy-connection",
          schemaVersion: 1,
          kind: "remote-runtime",
          provider: "openai",
          label: "Remote runtime",
          url: "https://legacy.example/v1",
          model: "Mock adapter",
          summary: "Uses configured runtime settings.",
          status: "ready",
          modelLabel: "Mock adapter",
          agentDefault: false,
          maxContext: null,
          maxOutput: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreads: [
        {
          id: "legacy-thread",
          kind: "messenger",
          title: "Imported thread",
          characterIds: ["legacy-character"],
          activePersonaId: "legacy-persona",
          providerConnectionId: "legacy-connection",
          messages: [
            {
              id: "legacy-message",
              body: "Hello.",
              author: {
                kind: "character",
                characterId: "legacy-character",
                label: "Mara",
              },
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.counts).toMatchObject({
      characters: 1,
      personas: 1,
      providerConnections: 1,
      messengerThreads: 1,
      messengerMessages: 1,
    });
    expect(result.preview.data.characters[0]).toMatchObject({
      nickname: "Mars",
      personality: "Brave and direct.",
    });
    expect(result.preview.data.personas[0]).toMatchObject({
      personality: "Careful and kind.",
    });
    expect(result.preview.data.providerConnections[0]).toMatchObject({
      label: "OpenAI",
      baseUrl: "https://legacy.example/v1",
      model: "gpt-4o-mini",
      summary: "OpenAI-compatible chat completion provider.",
      status: "needs-key",
    });
  });

  it("converts legacy local mock providers into native custom connections", () => {
    const result = normalizeLegacyImport({
      providerConnections: [
        {
          id: "connection-local-mock",
          schemaVersion: 1,
          kind: "mock",
          provider: "custom",
          label: "Local mock",
          baseUrl: "",
          model: "Mock adapter",
          summary: "",
          status: "ready",
          modelLabel: "Mock adapter",
          agentDefault: false,
          maxContext: null,
          maxOutput: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreads: [
        {
          id: "legacy-thread",
          kind: "messenger",
          title: "Imported thread",
          characterIds: [],
          providerConnectionId: "connection-local-mock",
          messages: [
            {
              id: "legacy-message",
              body: "Hello.",
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.counts).toMatchObject({
      providerConnections: 1,
      messengerThreads: 1,
      messengerMessages: 1,
    });
    expect(result.preview.warnings).toEqual([]);
    expect(result.preview.data.providerConnections[0]).toMatchObject({
      id: "connection-local-mock",
      kind: "remote-runtime",
      provider: "custom",
      label: "Local",
      baseUrl: "",
      model: "",
      status: "ready",
      modelLabel: null,
    });
    expect(result.preview.data.messengerThreads[0]?.providerConnectionId).toBe(
      "connection-local-mock",
    );
  });
});
