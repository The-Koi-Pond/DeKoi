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
      globalVariables: {
        weather: "rain",
        count: 3,
        " ": "dropped",
        nested: { unsupported: true },
      },
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
          variables: {
            mood: "calm",
            active: true,
          },
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
      macroVariableStates: 2,
      macroVariables: 4,
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
      kind: "provider",
      label: "OpenAI",
      baseUrl: "https://legacy.example/v1",
      model: "gpt-4o-mini",
      summary: "OpenAI-compatible chat completion provider.",
      status: "needs-key",
    });
    expect(result.preview.data.macroVariableStates).toEqual([
      {
        id: "macro-variable-state-imported-global",
        schemaVersion: 1,
        ownerKind: "global",
        ownerId: "global",
        variables: {
          weather: "rain",
          count: "3",
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
      {
        id: "macro-variable-state-imported-thread-1",
        schemaVersion: 1,
        ownerKind: "messenger-thread",
        ownerId: "legacy-thread",
        variables: {
          mood: "calm",
          active: "true",
        },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    expect(result.preview.data.messengerThreadMacroVariableStates).toEqual([
      {
        id: "macro-variable-state-imported-thread-1",
        schemaVersion: 1,
        ownerKind: "messenger-thread",
        ownerId: "legacy-thread",
        variables: {
          mood: "calm",
          active: "true",
        },
        createdAt: now,
        updatedAt: now,
      },
    ]);
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
      kind: "provider",
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

  it("imports global variable records without leaking source-native names into counts", () => {
    const result = normalizeLegacyImport({
      globalVariables: {
        weather: "rain",
      },
      createdAt: now,
      updatedAt: now,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.data).toMatchObject({
      sourceLabel: "Legacy chat variables JSON",
      macroVariableStates: [
        {
          id: "macro-variable-state-imported-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { weather: "rain" },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(result.preview.counts).toMatchObject({
      macroVariableStates: 1,
      macroVariables: 1,
    });
    expect(result.preview.data.messengerThreadMacroVariableStates).toEqual([]);
    expect(result.preview.warnings).toEqual([]);
  });

  it("keeps thread macro variables paired by thread position for duplicate legacy IDs", () => {
    const result = normalizeLegacyImport({
      messengerThreads: [
        {
          id: "legacy-thread",
          kind: "messenger",
          title: "A (no variables in source)",
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "legacy-thread",
          kind: "messenger",
          title: "B (has variables in source)",
          variables: {
            mood: "happy",
          },
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.data.messengerThreads.map((thread) => thread.title)).toEqual([
      "A (no variables in source)",
      "B (has variables in source)",
    ]);
    expect(result.preview.data.messengerThreadMacroVariableStates).toEqual([
      null,
      {
        id: "macro-variable-state-imported-thread-2",
        schemaVersion: 1,
        ownerKind: "messenger-thread",
        ownerId: "legacy-thread",
        variables: { mood: "happy" },
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  it("merges legacy global variables with later sources taking precedence", () => {
    const result = normalizeLegacyImport({
      globalVariables: {
        mood: "top-level",
        weather: "rain",
      },
      messengerThreads: [
        {
          id: "legacy-thread-first",
          kind: "messenger",
          title: "First imported thread",
          globalVariables: {
            mood: "first-thread",
          },
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "legacy-thread-second",
          kind: "messenger",
          title: "Second imported thread",
          globalVariables: {
            mood: "second-thread",
            day: "Tuesday",
          },
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    expect(result.preview.data.macroVariableStates[0]).toMatchObject({
      ownerKind: "global",
      ownerId: "global",
      variables: {
        mood: "second-thread",
        weather: "rain",
        day: "Tuesday",
      },
    });
    expect(result.preview.counts).toMatchObject({
      macroVariableStates: 1,
      macroVariables: 3,
    });
    expect(result.preview.warnings).toEqual([]);
  });
});
