import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
} from "../../../engine/catalog/lorebook-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import { generateMessengerThreadReply } from "./messenger-generation";
import { generateRoleplayThreadTurn } from "./roleplay-generation";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";
import {
  messengerMessage,
  messengerThread,
  roleplayMessage,
  roleplayThread,
} from "./test-fixtures";

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

const messengerInput = () => messengerMessage("Use literal /[bad/ text.");
const roleplayInput = () => roleplayMessage("Use literal /[bad/ text.");

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
    const message = messengerInput();
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
    const message = messengerInput();
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
    const message = messengerInput();
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
    expect(acceptedResult.generatedMessages[0]).toMatchObject({
      id: "messenger-message-1",
      activeVersionId: "messenger-message-version-1",
      versions: [{ id: "messenger-message-version-1", origin: "generated" }],
    });
    expect(acceptedResult.macroVariableCommit.variableMutations).toEqual([
      { kind: "set", name: "mood", value: "calm" },
    ]);
  });

  it("puts Messenger dropped-draft warnings before activation warnings when a reply survives", async () => {
    const message = messengerInput();
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
    const entry = roleplayInput();
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
    expect(result.generatedMessages[0]).toMatchObject({
      id: "roleplay-message-1",
      activeVersionId: "roleplay-message-version-1",
      versions: [{ id: "roleplay-message-version-1", origin: "generated" }],
    });
  });

  it("puts Roleplay no-output warnings before activation warnings", async () => {
    const entry = roleplayInput();
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

    expect(providerWarningResult.generatedMessageCount).toBe(0);
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

    expect(droppedDraftResult.generatedMessageCount).toBe(0);
    expect(droppedDraftResult.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(droppedDraftResult.warnings[1]).toContain(
      'Invalid regex key "/[bad/" treated as plaintext',
    );
  });

  it("omits Roleplay macro variable commits when no entry is accepted", async () => {
    const entry = roleplayInput();
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

    expect(noEntryResult.generatedMessageCount).toBe(0);
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

    expect(acceptedResult.generatedMessageCount).toBe(1);
    expect(acceptedResult.macroVariableCommit.variableMutations).toEqual([
      { kind: "set", name: "mood", value: "calm" },
    ]);
  });

  it("puts Roleplay dropped-draft warnings before activation warnings when an entry survives", async () => {
    const entry = roleplayInput();
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

    expect(result.generatedMessageCount).toBe(1);
    expect(result.warnings[0]).toBe(
      "Generation response referenced an unavailable companion: missing-character.",
    );
    expect(result.warnings[1]).toContain('Invalid regex key "/[bad/" treated as plaintext');
  });
});
