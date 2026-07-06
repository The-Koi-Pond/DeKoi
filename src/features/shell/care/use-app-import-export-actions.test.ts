import { describe, expect, it } from "vitest";

import { prepareLegacyImportData } from "./use-app-import-export-actions";
import type { DeKoiLegacyImportData } from "../../runtime";

const now = "2026-07-06T00:00:00.000Z";

function createCharacter(
  id: string,
  displayName: string,
): DeKoiLegacyImportData["characters"][number] {
  return {
    id,
    schemaVersion: 1,
    displayName,
    nickname: null,
    description: "",
    personality: "",
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
  };
}

function createPersona(id: string, displayName: string): DeKoiLegacyImportData["personas"][number] {
  return {
    id,
    schemaVersion: 1,
    displayName,
    nickname: null,
    description: "",
    personality: "",
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
  };
}

function createProviderConnection(
  id: string,
  label: string,
): DeKoiLegacyImportData["providerConnections"][number] {
  return {
    id,
    schemaVersion: 1,
    kind: "remote-runtime",
    provider: "custom",
    label,
    baseUrl: "",
    model: "",
    summary: "",
    status: "ready",
    modelLabel: null,
    agentDefault: false,
    maxContext: null,
    maxOutput: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("prepareLegacyImportData", () => {
  it("remaps imported catalog ids and thread references before append", () => {
    const data: DeKoiLegacyImportData = {
      sourceLabel: "Legacy DeKoi export",
      characters: [
        {
          id: "legacy-character",
          schemaVersion: 1,
          displayName: "Mara",
          nickname: "Mars",
          description: "",
          personality: "",
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
          personality: "",
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
          provider: "custom",
          label: "Local",
          baseUrl: "",
          model: "",
          summary: "",
          status: "ready",
          modelLabel: null,
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
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Imported thread",
          characterIds: ["legacy-character"],
          activePersonaId: "legacy-persona",
          lorebookIds: [],
          presetId: null,
          providerConnectionId: "legacy-connection",
          systemPromptMode: "default",
          systemPrompt: "",
          messages: [
            {
              id: "legacy-message",
              schemaVersion: 1,
              threadId: "legacy-thread",
              author: {
                kind: "character",
                characterId: "legacy-character",
                label: "Mara",
              },
              body: "Hello.",
              origin: "imported",
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const prepared = prepareLegacyImportData(data);
    const characterId = prepared.characters[0]?.id;
    const personaId = prepared.personas[0]?.id;
    const providerConnectionId = prepared.providerConnections[0]?.id;
    const thread = prepared.messengerThreads[0];
    const message = thread?.messages[0];

    expect(characterId).toMatch(/^character-/);
    expect(personaId).toMatch(/^persona-/);
    expect(providerConnectionId).toMatch(/^connection-/);
    expect(thread?.id).toMatch(/^messenger-thread-/);
    expect(message?.id).toMatch(/^messenger-message-/);
    expect(thread?.characterIds).toEqual([characterId]);
    expect(thread?.activePersonaId).toBe(personaId);
    expect(thread?.providerConnectionId).toBe(providerConnectionId);
    expect(message?.threadId).toBe(thread?.id);
    expect(message?.author).toMatchObject({
      kind: "character",
      characterId,
    });
  });

  it("clears imported thread provider references when the provider was not converted", () => {
    const data: DeKoiLegacyImportData = {
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      providerConnections: [],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Imported thread",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: "connection-skipped",
          systemPromptMode: "default",
          systemPrompt: "",
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const prepared = prepareLegacyImportData(data);

    expect(prepared.messengerThreads[0]?.providerConnectionId).toBeNull();
  });

  it("keeps imported record ids distinct when legacy ids are duplicated", () => {
    const data: DeKoiLegacyImportData = {
      sourceLabel: "Legacy DeKoi export",
      characters: [
        createCharacter("legacy-character", "First character"),
        createCharacter("legacy-character", "Second character"),
      ],
      personas: [
        createPersona("legacy-persona", "First persona"),
        createPersona("legacy-persona", "Second persona"),
      ],
      providerConnections: [
        createProviderConnection("legacy-connection", "First connection"),
        createProviderConnection("legacy-connection", "Second connection"),
      ],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Imported thread",
          characterIds: ["legacy-character"],
          activePersonaId: "legacy-persona",
          lorebookIds: [],
          presetId: null,
          providerConnectionId: "legacy-connection",
          systemPromptMode: "default",
          systemPrompt: "",
          messages: [
            {
              id: "legacy-message-character",
              schemaVersion: 1,
              threadId: "legacy-thread",
              author: {
                kind: "character",
                characterId: "legacy-character",
                label: "First character",
              },
              body: "Hello.",
              origin: "imported",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "legacy-message-persona",
              schemaVersion: 1,
              threadId: "legacy-thread",
              author: {
                kind: "persona",
                personaId: "legacy-persona",
                label: "First persona",
              },
              body: "Hi.",
              origin: "imported",
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    };

    const prepared = prepareLegacyImportData(data);
    const thread = prepared.messengerThreads[0];
    const characterIds = prepared.characters.map((character) => character.id);
    const personaIds = prepared.personas.map((persona) => persona.id);
    const providerConnectionIds = prepared.providerConnections.map((connection) => connection.id);

    expect(new Set(characterIds).size).toBe(2);
    expect(new Set(personaIds).size).toBe(2);
    expect(new Set(providerConnectionIds).size).toBe(2);
    expect(thread?.characterIds).toEqual([characterIds[0]]);
    expect(thread?.activePersonaId).toBe(personaIds[0]);
    expect(thread?.providerConnectionId).toBe(providerConnectionIds[0]);
    expect(thread?.messages[0]?.author).toMatchObject({
      kind: "character",
      characterId: characterIds[0],
    });
    expect(thread?.messages[1]?.author).toMatchObject({
      kind: "persona",
      personaId: personaIds[0],
    });
  });
});
