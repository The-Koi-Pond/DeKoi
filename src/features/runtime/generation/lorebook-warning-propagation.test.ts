import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
} from "../../../engine/catalog/lorebook-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { RoleplayEntry, RoleplayThread } from "../../../engine/contracts/types/roleplay";
import { generateMessengerThreadReply } from "./messenger-generation";
import { generateRoleplayThreadTurn } from "./roleplay-generation";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";

vi.mock("./provider-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./provider-generation")>();
  return {
    ...actual,
    generateWithConfiguredProvider: vi.fn(),
  };
});

const now = "2026-07-02T00:00:00.000Z";

function companion() {
  return createCharacterRecord({
    id: "character-1",
    input: { displayName: "Mara" },
    now,
  });
}

function createId(prefix: string) {
  return `${prefix}-1`;
}

function invalidRegexLorebook(): LorebookRecord {
  const lorebook = createLorebookRecord({
    id: "lorebook-1",
    input: {
      title: "Regex Lore",
      activation: { matchWholeWords: false },
    },
    now,
  });
  return {
    ...lorebook,
    entries: [
      createLorebookEntryRecord({
        id: "entry-1",
        input: {
          title: "Invalid Regex",
          body: "Invalid regex entry still activates.",
          strategy: "selective",
          key: ["/[bad/"],
        },
        now,
      }),
    ],
  };
}

function variableLorebook(): LorebookRecord {
  const lorebook = createLorebookRecord({
    id: "lorebook-1",
    input: {
      title: "Variable Lore",
    },
    now,
  });
  return {
    ...lorebook,
    entries: [
      createLorebookEntryRecord({
        id: "entry-1",
        input: {
          title: "Variable",
          body: "{{setvar::mood::calm}}Mood lore.",
          strategy: "constant",
        },
        now,
      }),
    ],
  };
}

function messengerMessage(): MessengerMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: "messenger-thread-1",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body: "Use literal /[bad/ text.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

function messengerThread(message: MessengerMessage): MessengerThread {
  return {
    id: "messenger-thread-1",
    schemaVersion: 1,
    kind: "messenger",
    mode: "direct",
    title: "Thread",
    characterIds: ["character-1"],
    activePersonaId: null,
    lorebookIds: ["lorebook-1"],
    presetId: null,
    providerConnectionId: null,
    systemPromptMode: "default",
    systemPrompt: "",
    messages: [message],
    createdAt: now,
    updatedAt: now,
  };
}

function roleplayEntry(): RoleplayEntry {
  return {
    id: "entry-1",
    schemaVersion: 1,
    threadId: "roleplay-thread-1",
    role: "persona",
    characterId: null,
    personaId: "persona-1",
    label: "Alex",
    body: "Use literal /[bad/ text.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

function roleplayThread(entry: RoleplayEntry): RoleplayThread {
  return {
    id: "roleplay-thread-1",
    schemaVersion: 1,
    kind: "roleplay",
    mode: "scene",
    title: "Scene",
    sceneText: "",
    characterIds: ["character-1"],
    activePersonaId: null,
    lorebookIds: ["lorebook-1"],
    providerConnectionId: null,
    entries: [entry],
    createdAt: now,
    updatedAt: now,
  };
}

describe("lorebook warning propagation", () => {
  beforeEach(() => {
    vi.mocked(generateWithConfiguredProvider).mockImplementation(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: request.targetCharacterId
          ? [{ characterId: request.targetCharacterId, body: "Generated." }]
          : [],
        warnings: [],
      }),
    );
  });

  it("includes Messenger activation warnings in runtime results", async () => {
    const message = messengerMessage();
    const result = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(result.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("puts Messenger no-output warnings before activation warnings", async () => {
    const message = messengerMessage();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [],
        warnings: ["Provider returned no text."],
      }),
    );

    const providerWarningResult = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(providerWarningResult.generatedMessages).toEqual([]);
    expect(providerWarningResult.warnings[0]).toBe("Provider returned no text.");
    expect(providerWarningResult.warnings[1]).toContain(
      'Invalid regex key "/[bad/" treated as plaintext',
    );

    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [{ characterId: "missing-character", body: "Generated." }],
        warnings: [],
      }),
    );

    const droppedDraftResult = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(droppedDraftResult.generatedMessages).toEqual([]);
    expect(droppedDraftResult.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(droppedDraftResult.warnings[1]).toContain(
      'Invalid regex key "/[bad/" treated as plaintext',
    );
  });

  it("omits Messenger macro variable commits when no reply is accepted", async () => {
    const message = messengerMessage();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [],
        warnings: ["Provider returned no text."],
      }),
    );

    const noReplyResult = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [variableLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(noReplyResult.generatedMessages).toEqual([]);
    expect(noReplyResult.macroVariableCommit.variableMutations).toEqual([]);

    const acceptedResult = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [variableLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(acceptedResult.generatedMessages).toHaveLength(1);
    expect(acceptedResult.macroVariableCommit.variableMutations).toEqual([
      { kind: "set", name: "mood", value: "calm" },
    ]);
  });

  it("puts Messenger dropped-draft warnings before activation warnings when a reply survives", async () => {
    const message = messengerMessage();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [
          { characterId: "character-1", body: "Generated." },
          { characterId: "missing-character", body: "Dropped." },
        ],
        warnings: [],
      }),
    );

    const result = await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    expect(result.generatedMessages).toHaveLength(1);
    expect(result.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(result.warnings[1]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("includes Roleplay activation warnings in runtime results", async () => {
    const entry = roleplayEntry();
    const result = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(result.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });

  it("puts Roleplay no-output warnings before activation warnings", async () => {
    const entry = roleplayEntry();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [],
        warnings: ["Provider returned no text."],
      }),
    );

    const providerWarningResult = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(providerWarningResult.generatedEntryCount).toBe(0);
    expect(providerWarningResult.warnings[0]).toBe("Provider returned no text.");
    expect(providerWarningResult.warnings[1]).toContain(
      'Invalid regex key "/[bad/" treated as plaintext',
    );

    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [{ characterId: "missing-character", body: "Generated." }],
        warnings: [],
      }),
    );

    const droppedDraftResult = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(droppedDraftResult.generatedEntryCount).toBe(0);
    expect(droppedDraftResult.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(droppedDraftResult.warnings[1]).toContain(
      'Invalid regex key "/[bad/" treated as plaintext',
    );
  });

  it("omits Roleplay macro variable commits when no entry is accepted", async () => {
    const entry = roleplayEntry();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [],
        warnings: ["Provider returned no text."],
      }),
    );

    const noEntryResult = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [variableLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(noEntryResult.generatedEntryCount).toBe(0);
    expect(noEntryResult.macroVariableCommit.variableMutations).toEqual([]);

    const acceptedResult = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [variableLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(acceptedResult.generatedEntryCount).toBe(1);
    expect(acceptedResult.macroVariableCommit.variableMutations).toEqual([
      { kind: "set", name: "mood", value: "calm" },
    ]);
  });

  it("puts Roleplay dropped-draft warnings before activation warnings when an entry survives", async () => {
    const entry = roleplayEntry();
    vi.mocked(generateWithConfiguredProvider).mockImplementationOnce(
      async (request: ProviderGenerationRequest) => ({
        schemaVersion: 1,
        requestId: request.id,
        source: "provider-transport",
        createdAt: now,
        messages: [
          { characterId: "character-1", body: "Generated." },
          { characterId: "missing-character", body: "Dropped." },
        ],
        warnings: [],
      }),
    );

    const result = await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [invalidRegexLorebook()],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    expect(result.generatedEntryCount).toBe(1);
    expect(result.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(result.warnings[1]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });
});
