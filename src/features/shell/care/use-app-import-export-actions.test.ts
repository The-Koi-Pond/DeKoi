import { describe, expect, it } from "vitest";

import {
  getLegacyImportPreviewWarnings,
  createLegacyImportDataFingerprint,
  mergeLegacyImportMacroVariableStates,
  prepareLegacyImportData,
  verifyAndPrepareLegacyImportData,
} from "./use-app-import-export-actions";
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
    kind: "provider",
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

function createMacroVariableState(
  id: string,
  ownerKind: DeKoiLegacyImportData["macroVariableStates"][number]["ownerKind"],
  ownerId: string,
  variables: Record<string, string>,
): DeKoiLegacyImportData["macroVariableStates"][number] {
  return {
    id,
    schemaVersion: 1,
    ownerKind,
    ownerId,
    variables,
    createdAt: now,
    updatedAt: now,
  };
}

function createCanonicalImportData(
  data: Omit<DeKoiLegacyImportData, "modeThreads">,
): DeKoiLegacyImportData {
  const modeThreads: DeKoiLegacyImportData["modeThreads"] = data.messengerThreads.map((thread) => {
    const branchId = `${thread.id}-branch-1`;
    return {
      id: thread.id,
      schemaVersion: 1 as const,
      kind: "messenger" as const,
      title: thread.title,
      activeBranchId: branchId,
      branches: [
        {
          id: branchId,
          schemaVersion: 1 as const,
          threadId: thread.id,
          kind: "messenger" as const,
          participantMode: thread.mode,
          characterIds: thread.characterIds,
          activePersonaId: thread.activePersonaId,
          lorebookIds: thread.lorebookIds,
          presetId: thread.presetId,
          presetChoiceSelectionsByPresetId: thread.presetChoiceSelectionsByPresetId ?? {},
          providerConnectionId: thread.providerConnectionId,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        },
      ],
      messages: thread.messages.map((message) => ({
        id: message.id,
        schemaVersion: 1 as const,
        threadId: thread.id,
        branchId,
        author: message.author,
        versions: [
          {
            id: `${message.id}-v1`,
            body: message.body,
            origin: message.origin === "placeholder" ? ("imported" as const) : message.origin,
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
          },
        ],
        activeVersionId: `${message.id}-v1`,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })),
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  });
  return { ...data, modeThreads };
}

describe("prepareLegacyImportData", () => {
  it("does not mint ids for stale previews and restamps only on a matching preview", () => {
    const data = createCanonicalImportData({
      sourceLabel: "legacy",
      characters: [createCharacter("legacy", "Legacy")],
      personas: [],
      providerConnections: [],
      macroVariableStates: [],
      messengerThreadMacroVariableStates: [],
      messengerThreads: [],
    });
    let calls = 0;
    const factory = (prefix: string) => `${prefix}-${calls++}`;
    expect(verifyAndPrepareLegacyImportData(data, "stale", factory)).toBeNull();
    expect(calls).toBe(0);
    const fingerprint = createLegacyImportDataFingerprint(data);
    const prepared = verifyAndPrepareLegacyImportData(data, fingerprint, factory);
    expect(prepared).toBeTruthy();
    expect(calls).toBeGreaterThan(0);
  });

  it("rejects a preview when positional thread variables change", () => {
    const threadVariables = createMacroVariableState(
      "macro-variable-state-thread",
      "mode-branch",
      "legacy-thread-branch-1",
      { mood: "calm" },
    );
    const data = createCanonicalImportData({
      sourceLabel: "legacy",
      characters: [],
      personas: [],
      providerConnections: [],
      macroVariableStates: [threadVariables],
      messengerThreadMacroVariableStates: [threadVariables],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Legacy",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    const fingerprint = createLegacyImportDataFingerprint(data);
    let calls = 0;

    expect(
      verifyAndPrepareLegacyImportData(
        { ...data, messengerThreadMacroVariableStates: [null] },
        fingerprint,
        (prefix) => `${prefix}-${calls++}`,
      ),
    ).toBeNull();
    expect(calls).toBe(0);
  });
  it("remaps imported catalog ids and thread references before append", () => {
    const data = createCanonicalImportData({
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
      macroVariableStates: [
        {
          id: "macro-variable-state-legacy-thread",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "calm" },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "macro-variable-state-legacy-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { weather: "rain" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreadMacroVariableStates: [
        {
          id: "macro-variable-state-legacy-thread",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "calm" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      providerConnections: [
        {
          id: "legacy-connection",
          schemaVersion: 1,
          kind: "provider",
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
    });

    const prepared = prepareLegacyImportData(data);
    const characterId = prepared.characters[0]?.id;
    const personaId = prepared.personas[0]?.id;
    const providerConnectionId = prepared.providerConnections[0]?.id;
    const thread = prepared.modeThreads[0];
    const activeBranch = thread?.branches.find((branch) => branch.id === thread.activeBranchId);
    const message = prepared.modeThreads[0]?.messages[0];
    const threadVariableState = prepared.macroVariableStates.find(
      (state) => state.ownerKind === "mode-branch",
    );
    const globalVariableState = prepared.macroVariableStates.find(
      (state) => state.ownerKind === "global",
    );

    expect(characterId).toMatch(/^character-/);
    expect(personaId).toMatch(/^persona-/);
    expect(providerConnectionId).toMatch(/^connection-/);
    expect(thread?.id).toMatch(/^mode-thread-/);
    expect(message?.id).toMatch(/^mode-message-/);
    expect(activeBranch?.characterIds).toEqual([characterId]);
    expect(activeBranch?.activePersonaId).toBe(personaId);
    expect(activeBranch?.providerConnectionId).toBe(providerConnectionId);
    expect(message?.threadId).toBe(thread?.id);
    expect(message?.branchId).toBe(activeBranch?.id);
    expect(message?.versions).toHaveLength(1);
    expect(message?.activeVersionId).toBe(message?.versions[0]?.id);
    expect(message?.versions[0]).toMatchObject({
      body: "Hello.",
      origin: "imported",
    });
    expect(message?.author).toMatchObject({
      kind: "character",
      characterId,
    });
    expect(threadVariableState).toMatchObject({
      id: expect.stringMatching(/^macro-variable-state-/),
      ownerKind: "mode-branch",
      ownerId: activeBranch?.id,
      variables: { mood: "calm" },
    });
    expect(globalVariableState).toMatchObject({
      id: expect.stringMatching(/^macro-variable-state-/),
      ownerKind: "global",
      ownerId: "global",
      variables: { weather: "rain" },
    });
  });

  it("clears imported thread provider references when the provider was not converted", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      macroVariableStates: [],
      messengerThreadMacroVariableStates: [null],
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
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const prepared = prepareLegacyImportData(data);

    const thread = prepared.modeThreads[0];
    const activeBranch = thread?.branches.find((branch) => branch.id === thread.activeBranchId);
    expect(activeBranch?.providerConnectionId).toBeNull();
  });

  it("clears imported thread catalog references when catalog records were not converted", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      macroVariableStates: [],
      messengerThreadMacroVariableStates: [null],
      providerConnections: [],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Imported thread",
          characterIds: ["character-skipped"],
          activePersonaId: "persona-skipped",
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [
            {
              id: "legacy-message-character",
              schemaVersion: 1,
              threadId: "legacy-thread",
              author: {
                kind: "character",
                characterId: "character-skipped",
                label: "Skipped character",
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
                personaId: "persona-skipped",
                label: "Skipped persona",
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
    });

    const prepared = prepareLegacyImportData(data);
    const thread = prepared.modeThreads[0];
    const activeBranch = thread?.branches.find((branch) => branch.id === thread.activeBranchId);
    const messages = thread?.messages ?? [];

    expect(activeBranch?.characterIds).toEqual([]);
    expect(activeBranch?.activePersonaId).toBeNull();
    expect(messages[0]?.author).toEqual({
      kind: "unknown",
      label: "Skipped character",
    });
    expect(messages[1]?.author).toEqual({
      kind: "unknown",
      label: "Skipped persona",
    });
  });

  it("keeps imported record ids distinct when legacy ids are duplicated", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [
        createCharacter("legacy-character", "First character"),
        createCharacter("legacy-character", "Second character"),
      ],
      personas: [
        createPersona("legacy-persona", "First persona"),
        createPersona("legacy-persona", "Second persona"),
      ],
      macroVariableStates: [],
      messengerThreadMacroVariableStates: [null],
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
    });

    const prepared = prepareLegacyImportData(data);
    const thread = prepared.modeThreads[0];
    const activeBranch = thread?.branches.find((branch) => branch.id === thread.activeBranchId);
    const messages = thread?.messages ?? [];
    const characterIds = prepared.characters.map((character) => character.id);
    const personaIds = prepared.personas.map((persona) => persona.id);
    const providerConnectionIds = prepared.providerConnections.map((connection) => connection.id);

    expect(new Set(characterIds).size).toBe(2);
    expect(new Set(personaIds).size).toBe(2);
    expect(new Set(providerConnectionIds).size).toBe(2);
    expect(activeBranch?.characterIds).toEqual([characterIds[0]]);
    expect(activeBranch?.activePersonaId).toBe(personaIds[0]);
    expect(activeBranch?.providerConnectionId).toBe(providerConnectionIds[0]);
    expect(messages[0]?.author).toMatchObject({
      kind: "character",
      characterId: characterIds[0],
    });
    expect(messages[1]?.author).toMatchObject({
      kind: "persona",
      personaId: personaIds[0],
    });
  });

  it("keeps duplicate legacy thread macro variables attached to their matching imported thread", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      macroVariableStates: [
        {
          id: "macro-variable-state-first-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "first" },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "macro-variable-state-second-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "second" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreadMacroVariableStates: [
        {
          id: "macro-variable-state-first-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "first" },
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "macro-variable-state-second-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "second" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      providerConnections: [],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "First imported thread",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "Second imported thread",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const prepared = prepareLegacyImportData(data);

    expect(prepared.modeThreads).toHaveLength(2);
    expect(prepared.macroVariableStates).toHaveLength(2);
    const firstThread = prepared.modeThreads[0];
    const secondThread = prepared.modeThreads[1];
    const firstBranch = firstThread?.branches.find(
      (branch) => branch.id === firstThread.activeBranchId,
    );
    const secondBranch = secondThread?.branches.find(
      (branch) => branch.id === secondThread.activeBranchId,
    );
    expect(prepared.macroVariableStates[0]).toMatchObject({
      ownerId: firstBranch?.id,
      variables: { mood: "first" },
    });
    expect(prepared.macroVariableStates[1]).toMatchObject({
      ownerId: secondBranch?.id,
      variables: { mood: "second" },
    });
    expect(prepared.macroVariableStates[0]?.ownerId).not.toBe(
      prepared.macroVariableStates[1]?.ownerId,
    );
  });

  it("keeps asymmetric duplicate legacy thread variables attached to the source thread", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      macroVariableStates: [
        {
          id: "macro-variable-state-second-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "happy" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreadMacroVariableStates: [
        null,
        {
          id: "macro-variable-state-second-duplicate",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "legacy-thread",
          variables: { mood: "happy" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      providerConnections: [],
      messengerThreads: [
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "A (no variables in source)",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "legacy-thread",
          schemaVersion: 1,
          kind: "messenger",
          mode: "direct",
          title: "B (has variables in source)",
          characterIds: [],
          activePersonaId: null,
          lorebookIds: [],
          presetId: null,
          providerConnectionId: null,
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const prepared = prepareLegacyImportData(data);
    const firstThread = prepared.modeThreads[0];
    const secondThread = prepared.modeThreads[1];
    const firstBranch = firstThread?.branches.find(
      (branch) => branch.id === firstThread.activeBranchId,
    );
    const secondBranch = secondThread?.branches.find(
      (branch) => branch.id === secondThread.activeBranchId,
    );

    expect(prepared.macroVariableStates).toHaveLength(1);
    expect(prepared.macroVariableStates[0]).toMatchObject({
      ownerId: secondBranch?.id,
      variables: { mood: "happy" },
    });
    expect(prepared.macroVariableStates[0]?.ownerId).not.toBe(firstBranch?.id);
  });

  it("drops thread-scoped macro variables when their imported thread was not converted", () => {
    const data = createCanonicalImportData({
      sourceLabel: "Legacy DeKoi export",
      characters: [],
      personas: [],
      macroVariableStates: [
        {
          id: "macro-variable-state-orphaned",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "thread-skipped",
          variables: { mood: "lost" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      messengerThreadMacroVariableStates: [],
      providerConnections: [],
      messengerThreads: [],
    });

    const prepared = prepareLegacyImportData(data);

    expect(prepared.macroVariableStates).toEqual([]);
  });
});

describe("mergeLegacyImportMacroVariableStates", () => {
  it("merges imported global variables into the current global scope", () => {
    const merged = mergeLegacyImportMacroVariableStates(
      [
        {
          id: "macro-variable-state-imported-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { mood: "imported", scene: "rain" },
          createdAt: now,
          updatedAt: "2026-07-06T01:00:00.000Z",
        },
        {
          id: "macro-variable-state-imported-thread",
          schemaVersion: 1,
          ownerKind: "mode-branch",
          ownerId: "messenger-thread-imported",
          variables: { affection: "2" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      [
        {
          id: "macro-variable-state-current-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { mood: "current", day: "Tuesday" },
          createdAt: now,
          updatedAt: now,
        },
      ],
    );

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      ownerKind: "mode-branch",
      ownerId: "messenger-thread-imported",
      variables: { affection: "2" },
    });
    expect(merged[1]).toMatchObject({
      id: "macro-variable-state-current-global",
      ownerKind: "global",
      ownerId: "global",
      variables: { mood: "imported", day: "Tuesday", scene: "rain" },
      updatedAt: "2026-07-06T01:00:00.000Z",
    });
  });
});

describe("getLegacyImportPreviewWarnings", () => {
  it("warns only when imported globals collide with current globals", () => {
    const importedStates = [
      createMacroVariableState("macro-variable-state-imported-global", "global", "global", {
        mood: "imported",
        weather: "rain",
      }),
    ];

    expect(getLegacyImportPreviewWarnings([], importedStates, [])).toEqual([]);
    expect(
      getLegacyImportPreviewWarnings([], importedStates, [
        createMacroVariableState("macro-variable-state-current-global", "global", "global", {
          day: "Tuesday",
        }),
      ]),
    ).toEqual([]);
    expect(
      getLegacyImportPreviewWarnings(
        ["Skipped 1 unsupported legacy character record(s)."],
        importedStates,
        [
          createMacroVariableState("macro-variable-state-current-global", "global", "global", {
            mood: "current",
          }),
        ],
      ),
    ).toEqual([
      "Skipped 1 unsupported legacy character record(s).",
      "Imported global macro variables will overwrite same-name current global macro variables.",
    ]);
  });
});
