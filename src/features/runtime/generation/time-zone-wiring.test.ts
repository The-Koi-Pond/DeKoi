import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { RoleplayEntry, RoleplayThread } from "../../../engine/contracts/types/roleplay";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import { generateMessengerThreadReply } from "./messenger-generation";
import { generateRoleplayThreadTurn } from "./roleplay-generation";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";

vi.mock("../../../shared/browser/current-time", () => ({
  currentIsoTimestamp: () => "2026-07-02T00:00:00.000Z",
  currentLocalTimeZone: () => "Australia/Sydney",
}));

vi.mock("./provider-generation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./provider-generation")>();
  return {
    ...actual,
    generateWithConfiguredProvider: vi.fn(),
  };
});

const now = "2026-07-02T00:00:00.000Z";
const localTimeZone = "Australia/Sydney";

let capturedRequest: ProviderGenerationRequest | null = null;

function expectedLocalTimeParts() {
  const date = new Date(now);
  return {
    date: new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      timeZone: localTimeZone,
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: localTimeZone,
    }).format(date),
    timeZone: new Intl.DateTimeFormat("en-US", { timeZone: localTimeZone }).resolvedOptions()
      .timeZone,
    weekday: new Intl.DateTimeFormat("en-US", {
      timeZone: localTimeZone,
      weekday: "long",
    }).format(date),
  };
}

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

function messengerMessage(): MessengerMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: "messenger-thread-1",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body: "What time is it?",
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
    lorebookIds: [],
    presetId: "preset-1",
    providerConnectionId: null,
    messages: [message],
    createdAt: now,
    updatedAt: now,
  };
}

function messengerPreset(): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 1,
    title: "Messenger test",
    summary: null,
    systemPrompt: "Fallback",
    messengerPrompt: "Local: {{timezone}} {{weekday}} {{date}} {{time}}",
    sampling: null,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
    variableOrder: [],
    variableGroups: [],
    variableValues: {},
    defaultChoices: {},
    sections: [],
    groups: [],
    choiceBlocks: [],
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
    body: "What time is it?",
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
    sceneText: "Scene local: {{timezone}} {{weekday}} {{date}} {{time}}",
    characterIds: ["character-1"],
    activePersonaId: null,
    lorebookIds: [],
    presetId: null,
    providerConnectionId: null,
    entries: [entry],
    createdAt: now,
    updatedAt: now,
  };
}

function requireCapturedRequest() {
  if (capturedRequest === null) {
    throw new Error("Expected provider generation to receive a request.");
  }
  return capturedRequest;
}

function assembledPromptText(request: ProviderGenerationRequest) {
  return request.promptMessages.map((message) => message.content).join("\n\n");
}

describe("generation time zone wiring", () => {
  beforeEach(() => {
    capturedRequest = null;
    vi.mocked(generateWithConfiguredProvider).mockImplementation(
      async (request: ProviderGenerationRequest) => {
        capturedRequest = request;
        return {
          schemaVersion: 1,
          requestId: request.id,
          source: "provider-transport",
          createdAt: now,
          messages: request.targetCharacterId
            ? [{ characterId: request.targetCharacterId, body: "Generated." }]
            : [],
          warnings: [],
        };
      },
    );
  });

  it("uses the local time zone for Messenger prompt macros", async () => {
    const message = messengerMessage();
    await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      promptPresets: [messengerPreset()],
      now,
      personas: [],
      providerConnections: [],
      thread: messengerThread(message),
      userMessage: message,
    });

    const request = requireCapturedRequest();
    const expected = expectedLocalTimeParts();
    expect(assembledPromptText(request)).toContain(
      `Local: ${expected.timeZone} ${expected.weekday} ${expected.date} ${expected.time}`,
    );
  });

  it("uses the local time zone for Roleplay prompt macros", async () => {
    const entry = roleplayEntry();
    await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      now,
      personas: [],
      providerConnections: [],
      thread: roleplayThread(entry),
    });

    const request = requireCapturedRequest();
    const expected = expectedLocalTimeParts();
    expect(assembledPromptText(request)).toContain(
      `Scene local: ${expected.timeZone} ${expected.weekday} ${expected.date} ${expected.time}`,
    );
  });
});
