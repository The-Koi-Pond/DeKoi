import { describe, expect, it } from "vitest";

import {
  createLorebookEntryRecord,
  createLorebookRecord,
} from "../catalog/lorebook-actions";
import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord } from "../contracts/types/lorebook";
import type {
  MessengerMessage,
  MessengerThread,
} from "../contracts/types/messenger";
import type {
  RoleplayEntry,
  RoleplayThread,
} from "../contracts/types/roleplay";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
} from "./roleplay-generation";

const now = "2026-07-02T00:00:00.000Z";

function character(): CharacterRecord {
  return {
    id: "character-1",
    schemaVersion: 1,
    displayName: "Mara",
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
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0.5,
    avatarUrl: null,
    lorebookIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

function selectiveLorebook({
  entries,
  id,
  summary = "",
  title,
}: {
  id: string;
  title: string;
  summary?: string;
  entries: {
    body: string;
    id: string;
    key: string[];
    title: string;
  }[];
}): LorebookRecord {
  const record = createLorebookRecord({
    id,
    input: { title, summary },
    now,
  });

  return {
    ...record,
    entries: entries.map((entry) =>
      createLorebookEntryRecord({
        id: entry.id,
        input: {
          title: entry.title,
          body: entry.body,
          strategy: "selective",
          key: entry.key,
        },
        now,
      }),
    ),
  };
}

function messengerMessage(id: string, body: string): MessengerMessage {
  return {
    id,
    schemaVersion: 1,
    threadId: "messenger-thread-1",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body,
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

function roleplayEntry(id: string, body: string): RoleplayEntry {
  return {
    id,
    schemaVersion: 1,
    threadId: "roleplay-thread-1",
    role: "persona",
    characterId: null,
    personaId: "persona-1",
    label: "Alex",
    body,
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

describe("generation lorebook activation wiring", () => {
  it("filters Messenger selected lore from message scan sources", () => {
    const thread: MessengerThread = {
      id: "messenger-thread-1",
      schemaVersion: 1,
      kind: "messenger",
      mode: "direct",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      systemPromptMode: "default",
      systemPrompt: "",
      messages: [messengerMessage("message-1", "Did you see the canal?")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createMessengerGenerationContext({
      thread,
      characters: [character()],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          entries: [
            {
              id: "match",
              title: "Canal",
              body: "The canals run under the old district.",
              key: ["canal"],
            },
            {
              id: "miss",
              title: "Tower",
              body: "The tower bell rings at dawn.",
              key: ["tower"],
            },
          ],
        }),
      ],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[0],
    });
    const systemPrompt = request.promptMessages[0].content;

    expect(systemPrompt).toContain(
      "City Lore / Canal: The canals run under the old district.",
    );
    expect(systemPrompt).not.toContain("The tower bell rings at dawn.");
  });

  it("includes Roleplay lorebook summaries only when an entry activates", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore", "lake-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "We should look for the grove.")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createRoleplayGenerationContext({
      thread,
      characters: [character()],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "forest-lore",
          title: "Forest Lore",
          summary: "Things known in the forest.",
          entries: [
            {
              id: "match",
              title: "Grove",
              body: "The hidden grove opens at sunset.",
              key: ["grove"],
            },
          ],
        }),
        selectiveLorebook({
          id: "lake-lore",
          title: "Lake Lore",
          summary: "Things known near the lake.",
          entries: [
            {
              id: "miss",
              title: "Lake",
              body: "The lake freezes in summer.",
              key: ["lake"],
            },
          ],
        }),
      ],
    });

    const request = createRoleplayGenerationRequest({
      context,
      id: "request-1",
      now,
    });
    const systemPrompt = request.promptMessages[0].content;

    expect(systemPrompt).toContain("Forest Lore: Things known in the forest.");
    expect(systemPrompt).toContain(
      "Forest Lore / Grove: The hidden grove opens at sunset.",
    );
    expect(systemPrompt).not.toContain("Lake Lore: Things known near the lake.");
    expect(systemPrompt).not.toContain("The lake freezes in summer.");
  });
});
