import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
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

vi.mock("../../../shared/browser/current-time", () => ({
  currentIsoTimestamp: () => "2026-07-02T00:00:00.000Z",
  currentLocalTimeZone: () => "Australia/Sydney",
}));
vi.mock("./provider-generation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./provider-generation")>()),
  generateWithConfiguredProvider: vi.fn(),
}));

const now = "2026-07-02T00:00:00.000Z";
const localTimeZone = "Australia/Sydney";
let capturedRequest: ProviderGenerationRequest | null = null;
const createId = (prefix: string) => `${prefix}-1`;
const companion = () =>
  createCharacterRecord({ id: "character-1", input: { displayName: "Mara" }, now });
const macroPreset = {
  id: "preset-time",
  schemaVersion: 2 as const,
  name: "Time",
  messengerPrompt: "Local: {{timezone}} {{weekday}} {{date}} {{time}}",
  parameters: null,
  sectionOrder: ["time-roleplay"],
  groupOrder: [],
  variableGroups: [],
  variableValues: {},
  defaultChoices: {},
  sections: [
    {
      id: "time-roleplay",
      identifier: "time-roleplay",
      name: "Time",
      content: "Local: {{timezone}} {{weekday}} {{date}} {{time}}",
      role: "system" as const,
      enabled: true,
      isMarker: false,
    },
  ],
  groups: [],
  choiceBlocks: [],
  createdAt: now,
  updatedAt: now,
};
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
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: localTimeZone, weekday: "long" }).format(
      date,
    ),
  };
}
const assembledPromptText = (request: ProviderGenerationRequest) =>
  request.promptMessages.map((message) => message.content).join("\n\n");

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
    const message = messengerMessage("What time is it?");
    const thread = messengerThread(message);
    thread.branches[0].presetId = macroPreset.id;
    await generateMessengerThreadReply({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      now,
      personas: [],
      promptPresets: [macroPreset],
      providerConnections: [],
      thread,
      userMessage: message,
    });
    const expected = expectedLocalTimeParts();
    expect(assembledPromptText(capturedRequest!)).toContain(
      `Local: ${expected.timeZone} ${expected.weekday} ${expected.date} ${expected.time}`,
    );
  });

  it("uses the local time zone for Roleplay prompt macros", async () => {
    const message = roleplayMessage("What time is it?");
    const thread = roleplayThread(message);
    thread.branches[0].presetId = macroPreset.id;
    await generateRoleplayThreadTurn({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [companion()],
      createId,
      lorebooks: [],
      now,
      personas: [],
      promptPresets: [macroPreset],
      providerConnections: [],
      thread,
    });
    const expected = expectedLocalTimeParts();
    expect(assembledPromptText(capturedRequest!)).toContain(
      `Local: ${expected.timeZone} ${expected.weekday} ${expected.date} ${expected.time}`,
    );
  });
});
