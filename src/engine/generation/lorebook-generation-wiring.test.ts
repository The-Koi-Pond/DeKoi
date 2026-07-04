import { describe, expect, it } from "vitest";

import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import { createProviderConnectionRecord } from "../catalog/provider-connection-actions";
import type { CharacterRecord } from "../contracts/types/character";
import type { PersonaRecord } from "../contracts/types/persona";
import type { LorebookActivationSettings, LorebookRecord } from "../contracts/types/lorebook";
import type { ProviderConnectionProvider } from "../contracts/types/provider-connection";
import type { MessengerMessage, MessengerThread } from "../contracts/types/messenger";
import type { RoleplayEntry, RoleplayThread } from "../contracts/types/roleplay";
import { activateLorebookEntries } from "../generation-core/lorebook-activation";
import {
  activateLoreGenerationEntriesWithWarnings,
  formatLoreGenerationEntries,
} from "./generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
} from "./roleplay-generation";

const now = "2026-07-02T00:00:00.000Z";

function character(input: Partial<CharacterRecord> = {}): CharacterRecord {
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
    createdAt: now,
    updatedAt: now,
    ...input,
    lorebookIds: input.lorebookIds ?? [],
  };
}

function persona(input: Partial<PersonaRecord> = {}): PersonaRecord {
  return {
    id: "persona-1",
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
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0.5,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...input,
    lorebookIds: input.lorebookIds ?? [],
  };
}

function providerConnection(provider: ProviderConnectionProvider) {
  return createProviderConnectionRecord({
    id: `connection-${provider}`,
    input: {
      label: provider,
      provider,
      baseUrl: "https://example.test",
      model: "test-model",
      hasSecret: true,
    },
    now,
  });
}

function selectiveLorebook({
  entries,
  id,
  summary = "",
  title,
  activation,
}: {
  id: string;
  title: string;
  summary?: string;
  activation?: Partial<LorebookActivationSettings>;
  entries: {
    body: string;
    id: string;
    input?: Partial<Parameters<typeof createLorebookEntryRecord>[0]["input"]>;
    key?: string[];
    title: string;
  }[];
}): LorebookRecord {
  const record = createLorebookRecord({
    id,
    input: { title, summary, activation },
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
          key: entry.key ?? [],
          ...entry.input,
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

    expect(systemPrompt).toContain("City Lore / Canal: The canals run under the old district.");
    expect(systemPrompt).not.toContain("The tower bell rings at dawn.");
  });

  it("surfaces Messenger invalid regex lorebook warnings on the request", () => {
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
      messages: [messengerMessage("message-1", "Use literal /[bad/ text.")],
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
          activation: { matchWholeWords: false },
          entries: [
            {
              id: "invalid-regex",
              title: "Invalid Regex",
              body: "This still activates as plaintext.",
              key: ["/[bad/"],
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

    expect(request.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
    expect(request.promptMessages[0].content).toContain("This still activates as plaintext.");
  });

  it("activates Messenger lore from opted-in companion and persona sources", () => {
    const thread: MessengerThread = {
      id: "messenger-thread-1",
      schemaVersion: 1,
      kind: "messenger",
      mode: "direct",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      systemPromptMode: "default",
      systemPrompt: "",
      messages: [messengerMessage("message-1", "No matching key here.")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "Carries a moonlit archive pass.",
          personality: "Watches the glass harbor.",
        }),
      ],
      personas: [persona({ description: "A violet cartographer." })],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          entries: [
            {
              id: "default-off",
              title: "Default Off",
              body: "Should not activate from character personality.",
              key: ["glass harbor"],
            },
            {
              id: "character-source",
              title: "Character Source",
              body: "Character description source activated.",
              key: ["moonlit archive"],
              input: {
                matchSources: {
                  characterDescription: true,
                  characterPersonality: false,
                  scenario: false,
                  characterNote: false,
                  personaDescription: false,
                },
              },
            },
            {
              id: "persona-source",
              title: "Persona Source",
              body: "Persona description source activated.",
              key: ["violet cartographer"],
              input: {
                matchSources: {
                  characterDescription: false,
                  characterPersonality: false,
                  scenario: false,
                  characterNote: false,
                  personaDescription: true,
                },
              },
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

    expect(systemPrompt).toContain("Character description source activated.");
    expect(systemPrompt).toContain("Persona description source activated.");
    expect(systemPrompt).not.toContain("Should not activate from character personality.");
  });

  it("surfaces Messenger invalid regex warnings from inactive lore entries", () => {
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
      messages: [messengerMessage("message-1", "Only the canal is here.")],
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
          activation: { matchWholeWords: false },
          entries: [
            {
              id: "invalid-regex",
              title: "Inactive Invalid Regex",
              body: "This entry should stay out of the prompt.",
              key: ["/[bad/"],
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

    expect(request.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
    expect(request.promptMessages[0].content).not.toContain(
      "This entry should stay out of the prompt.",
    );
  });

  it("ignores blank trailing Messenger messages before scan-depth accounting", () => {
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
      messages: [
        messengerMessage("message-1", "Did you see the canal?"),
        messengerMessage("message-2", "   "),
      ],
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
          activation: { scanDepth: 1 },
          entries: [
            {
              id: "match",
              title: "Canal",
              body: "The canals run under the old district.",
              key: ["canal"],
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

    expect(request.promptMessages[0].content).toContain(
      "City Lore / Canal: The canals run under the old district.",
    );
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
    expect(systemPrompt).toContain("Forest Lore / Grove: The hidden grove opens at sunset.");
    expect(systemPrompt).not.toContain("Lake Lore: Things known near the lake.");
    expect(systemPrompt).not.toContain("The lake freezes in summer.");
  });

  it("surfaces Roleplay invalid regex lorebook warnings on the request", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "Use literal /[bad/ text.")],
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
          activation: { matchWholeWords: false },
          entries: [
            {
              id: "invalid-regex",
              title: "Invalid Regex",
              body: "This still activates as plaintext.",
              key: ["/[bad/"],
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

    expect(request.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
    expect(request.promptMessages[0].content).toContain("This still activates as plaintext.");
  });

  it("activates Roleplay lore from opted-in companion and persona sources", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["forest-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "No matching key here.")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createRoleplayGenerationContext({
      thread,
      characters: [
        character({
          characterNote: "Bound to the silver rook.",
          scenario: "Hides the amber crossing.",
        }),
      ],
      personas: [persona({ description: "A quiet stargazer." })],
      lorebooks: [
        selectiveLorebook({
          id: "forest-lore",
          title: "Forest Lore",
          entries: [
            {
              id: "default-off",
              title: "Default Off",
              body: "Should not activate from scenario.",
              key: ["amber crossing"],
            },
            {
              id: "character-note-source",
              title: "Character Note Source",
              body: "Character note source activated.",
              key: ["silver rook"],
              input: {
                matchSources: {
                  characterDescription: false,
                  characterPersonality: false,
                  scenario: false,
                  characterNote: true,
                  personaDescription: false,
                },
              },
            },
            {
              id: "persona-source",
              title: "Persona Source",
              body: "Persona description source activated.",
              key: ["quiet stargazer"],
              input: {
                matchSources: {
                  characterDescription: false,
                  characterPersonality: false,
                  scenario: false,
                  characterNote: false,
                  personaDescription: true,
                },
              },
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
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(promptText).toContain("Character note source activated.");
    expect(promptText).toContain("Persona description source activated.");
    expect(promptText).not.toContain("Should not activate from scenario.");
  });

  it("activates Roleplay lore from chat, persona, character, and global sources without rewriting chat IDs", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["chat-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "Hello.")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createRoleplayGenerationContext({
      thread,
      appSettings: {
        globalLorebookIds: ["global-lore"],
        loreInsertionStrategy: "sorted-evenly",
      },
      characters: [character({ lorebookIds: ["character-lore"] })],
      personas: [persona({ lorebookIds: ["persona-lore"] })],
      lorebooks: [
        selectiveLorebook({
          id: "chat-lore",
          title: "Chat Lore",
          entries: [
            {
              id: "chat-entry",
              title: "Chat",
              body: "Roleplay chat-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "persona-lore",
          title: "Persona Lore",
          entries: [
            {
              id: "persona-entry",
              title: "Persona",
              body: "Roleplay persona-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "character-lore",
          title: "Character Lore",
          entries: [
            {
              id: "character-entry",
              title: "Character",
              body: "Roleplay character-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "global-lore",
          title: "Global Lore",
          entries: [
            {
              id: "global-entry",
              title: "Global",
              body: "Roleplay global-source lore.",
              input: { strategy: "constant" },
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
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(context.requestThread.lorebookIds).toEqual(["chat-lore"]);
    expect(request.lorebooks.map((lorebook) => lorebook.id)).toEqual([
      "chat-lore",
      "persona-lore",
      "character-lore",
      "global-lore",
    ]);
    expect(promptText).toContain("Roleplay chat-source lore.");
    expect(promptText).toContain("Roleplay persona-source lore.");
    expect(promptText).toContain("Roleplay character-source lore.");
    expect(promptText).toContain("Roleplay global-source lore.");
  });

  it("surfaces Roleplay invalid regex warnings from inactive lore entries", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "Only the grove is here.")],
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
          activation: { matchWholeWords: false },
          entries: [
            {
              id: "invalid-regex",
              title: "Inactive Invalid Regex",
              body: "This entry should stay out of the prompt.",
              key: ["/[bad/"],
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

    expect(request.warnings[0]).toContain('Invalid regex key "/[bad/" treated as plaintext');
    expect(request.promptMessages[0].content).not.toContain(
      "This entry should stay out of the prompt.",
    );
  });

  it("counts Roleplay lorebook summaries against the lore token budget", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
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
          summary: "Long summary that must consume more than one token.",
          activation: { budgetTokens: 1 },
          entries: [
            {
              id: "match",
              title: "Grove",
              body: "The hidden grove opens at sunset.",
              key: ["grove"],
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

    expect(systemPrompt).not.toContain(
      "Forest Lore: Long summary that must consume more than one token.",
    );
    expect(systemPrompt).not.toContain("Forest Lore / Grove: The hidden grove opens at sunset.");
  });

  it("emits a Roleplay lorebook summary once when entries use multiple positions", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
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
          summary: "Shared forest summary.",
          entries: [
            {
              id: "before",
              title: "Before",
              body: "Before-position grove lore.",
              key: ["grove"],
              input: { insertionPosition: "before-character" },
            },
            {
              id: "after",
              title: "After",
              body: "After-position grove lore.",
              key: ["grove"],
              input: { insertionPosition: "after-character" },
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
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(promptText.match(/Forest Lore: Shared forest summary\./g)).toHaveLength(1);
    expect(promptText).toContain("Before-position grove lore.");
    expect(promptText).toContain("After-position grove lore.");
  });

  it("marks lorebook summaries summarized only after emitting them", () => {
    const activated = activateLorebookEntries(
      selectiveLorebook({
        id: "forest-lore",
        title: "Forest Lore",
        summary: "Shared forest summary.",
        entries: [
          {
            id: "match",
            title: "Grove",
            body: "The hidden grove opens at sunset.",
            key: ["grove"],
          },
        ],
      }),
      "grove",
    );
    const summarizedLorebookIds = new Set<string>();

    expect(
      formatLoreGenerationEntries(activated, {
        includeSummary: false,
        summarizedLorebookIds,
      }),
    ).toEqual(["Forest Lore / Grove: The hidden grove opens at sunset."]);

    expect(
      formatLoreGenerationEntries(activated, {
        includeSummary: true,
        summarizedLorebookIds,
      }),
    ).toEqual([
      "Forest Lore: Shared forest summary.",
      "Forest Lore / Grove: The hidden grove opens at sunset.",
    ]);
  });

  it("keeps lorebook summaries at most once across formatter calls", () => {
    const activated = activateLorebookEntries(
      selectiveLorebook({
        id: "forest-lore",
        title: "Forest Lore",
        summary: "Shared forest summary.",
        entries: [
          {
            id: "match",
            title: "Grove",
            body: "The hidden grove opens at sunset.",
            key: ["grove"],
          },
        ],
      }),
      "grove",
    );
    const summarizedLorebookIds = new Set<string>();

    expect(
      formatLoreGenerationEntries(activated, {
        includeSummary: true,
        summarizedLorebookIds,
      }),
    ).toEqual([
      "Forest Lore: Shared forest summary.",
      "Forest Lore / Grove: The hidden grove opens at sunset.",
    ]);
    expect(
      formatLoreGenerationEntries(activated, {
        includeSummary: true,
        summarizedLorebookIds,
      }),
    ).toEqual(["Forest Lore / Grove: The hidden grove opens at sunset."]);
  });

  it("routes Messenger lore around character context by insertion position", () => {
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
              id: "before",
              title: "Before",
              body: "Before character lore.",
              input: {
                strategy: "constant",
                insertionPosition: "before-character",
                insertionOrder: 20,
              },
            },
            {
              id: "after",
              title: "After",
              body: "After character lore.",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
                insertionOrder: 10,
              },
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

    expect(systemPrompt.indexOf("Before character lore.")).toBeLessThan(
      systemPrompt.indexOf("Active persona"),
    );
    expect(systemPrompt.indexOf("After character lore.")).toBeGreaterThan(
      systemPrompt.indexOf("Replying companion"),
    );
  });

  it("dedupes a lorebook shared across character and global sources, keeping character", () => {
    const duplicateSourceLorebook = selectiveLorebook({
      id: "shared-source-lore",
      title: "Shared Source Lore",
      entries: [
        {
          id: "shared-entry",
          title: "Shared Entry",
          body: "Both sources carry this entry.",
          input: {
            strategy: "constant",
            insertionOrder: 10,
          },
        },
      ],
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [],
        persona: [],
        character: [duplicateSourceLorebook],
        global: [duplicateSourceLorebook],
      },
      { insertionStrategy: "character-first" },
    );

    expect(result.entries.map((entry) => entry.sourceKind)).toEqual(["character"]);
    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["shared-entry"]);
  });

  it("activates Messenger lore from chat, persona, character, and global sources without rewriting chat IDs", () => {
    const thread: MessengerThread = {
      id: "messenger-thread-1",
      schemaVersion: 1,
      kind: "messenger",
      mode: "direct",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["chat-lore"],
      presetId: null,
      providerConnectionId: null,
      systemPromptMode: "default",
      systemPrompt: "",
      messages: [messengerMessage("message-1", "Hello.")],
      createdAt: now,
      updatedAt: now,
    };
    const context = createMessengerGenerationContext({
      thread,
      appSettings: {
        globalLorebookIds: ["global-lore"],
        loreInsertionStrategy: "sorted-evenly",
      },
      characters: [character({ lorebookIds: ["character-lore"] })],
      personas: [persona({ lorebookIds: ["persona-lore"] })],
      lorebooks: [
        selectiveLorebook({
          id: "chat-lore",
          title: "Chat Lore",
          entries: [
            {
              id: "chat-entry",
              title: "Chat",
              body: "Chat-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "persona-lore",
          title: "Persona Lore",
          entries: [
            {
              id: "persona-entry",
              title: "Persona",
              body: "Persona-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "character-lore",
          title: "Character Lore",
          entries: [
            {
              id: "character-entry",
              title: "Character",
              body: "Character-source lore.",
              input: { strategy: "constant" },
            },
          ],
        }),
        selectiveLorebook({
          id: "global-lore",
          title: "Global Lore",
          entries: [
            {
              id: "global-entry",
              title: "Global",
              body: "Global-source lore.",
              input: { strategy: "constant" },
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

    expect(context.requestThread.lorebookIds).toEqual(["chat-lore"]);
    expect(request.lorebooks.map((lorebook) => lorebook.id)).toEqual([
      "chat-lore",
      "persona-lore",
      "character-lore",
      "global-lore",
    ]);
    expect(systemPrompt).toContain("Chat-source lore.");
    expect(systemPrompt).toContain("Persona-source lore.");
    expect(systemPrompt).toContain("Character-source lore.");
    expect(systemPrompt).toContain("Global-source lore.");
  });

  it("injects Messenger at-depth lore into the transcript with explicit role", () => {
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
      messages: [
        messengerMessage("message-1", "First turn."),
        messengerMessage("message-2", "Newest turn."),
      ],
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
              id: "depth",
              title: "Depth",
              body: "At-depth lore.",
              input: {
                strategy: "constant",
                insertionPosition: "at-depth",
                depth: 1,
                role: "user",
              },
            },
          ],
        }),
      ],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[1],
    });

    expect(request.promptMessages.map((message) => message.content)).toEqual([
      expect.stringContaining("Active persona"),
      "Alex: First turn.",
      expect.stringContaining("At-depth lore."),
      "Alex: Newest turn.",
    ]);
    expect(request.promptMessages[2].role).toBe("user");
  });

  it("keeps Messenger default at-depth lore as system for OpenAI-compatible providers", () => {
    const connection = providerConnection("openai");
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
      providerConnectionId: connection.id,
      systemPromptMode: "default",
      systemPrompt: "",
      messages: [
        messengerMessage("message-1", "First turn."),
        messengerMessage("message-2", "Newest turn."),
      ],
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
              id: "depth",
              title: "Depth",
              body: "Default system at-depth lore.",
              input: {
                strategy: "constant",
                insertionPosition: "at-depth",
                depth: 1,
                role: null,
              },
            },
          ],
        }),
      ],
      providerConnections: [connection],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[1],
    });

    expect(request.promptMessages.map((message) => message.content)).toEqual([
      expect.stringContaining("Active persona"),
      "Alex: First turn.",
      expect.stringContaining("Default system at-depth lore."),
      "Alex: Newest turn.",
    ]);
    expect(request.promptMessages[2].role).toBe("system");
  });

  it.each(["anthropic", "google"] as const)(
    "rewrites only at-depth system lore to user for %s while preserving depth",
    (provider) => {
      const connection = providerConnection(provider);
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
        providerConnectionId: connection.id,
        systemPromptMode: "default",
        systemPrompt: "",
        messages: [
          messengerMessage("message-1", "First turn."),
          messengerMessage("message-2", "Newest turn."),
        ],
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
                id: "before",
                title: "Before",
                body: "Before character lore.",
                input: {
                  strategy: "constant",
                  insertionPosition: "before-character",
                },
              },
              {
                id: "depth-system",
                title: "Depth System",
                body: "At-depth system lore.",
                input: {
                  strategy: "constant",
                  insertionPosition: "at-depth",
                  depth: 1,
                  role: "system",
                },
              },
              {
                id: "depth-assistant",
                title: "Depth Assistant",
                body: "At-depth assistant lore.",
                input: {
                  strategy: "constant",
                  insertionPosition: "at-depth",
                  depth: 1,
                  role: "assistant",
                },
              },
              {
                id: "after",
                title: "After",
                body: "After character lore.",
                input: {
                  strategy: "constant",
                  insertionPosition: "after-character",
                },
              },
            ],
          }),
        ],
        providerConnections: [connection],
      });

      const request = createMessengerGenerationRequest({
        context,
        id: "request-1",
        now,
        userMessage: thread.messages[1],
      });

      expect(request.promptMessages.map((message) => message.content)).toEqual([
        expect.stringContaining("Before character lore."),
        "Alex: First turn.",
        expect.stringContaining("At-depth system lore."),
        expect.stringContaining("At-depth assistant lore."),
        "Alex: Newest turn.",
      ]);
      expect(request.promptMessages[0].role).toBe("system");
      expect(request.promptMessages[0].content).toContain("After character lore.");
      expect(request.promptMessages[2].role).toBe("user");
      expect(request.promptMessages[3].role).toBe("assistant");
    },
  );

  it("injects Roleplay at-depth lore before the post-history prompt", () => {
    const thread: RoleplayThread = {
      id: "roleplay-thread-1",
      schemaVersion: 1,
      kind: "roleplay",
      mode: "scene",
      title: "Scene",
      sceneText: "",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      providerConnectionId: null,
      entries: [roleplayEntry("entry-1", "First turn."), roleplayEntry("entry-2", "Newest turn.")],
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
          summary: "Forest summary.",
          entries: [
            {
              id: "depth",
              title: "Depth",
              body: "Roleplay at-depth lore.",
              input: {
                strategy: "constant",
                insertionPosition: "at-depth",
                depth: 0,
                role: null,
              },
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

    expect(request.promptMessages.map((message) => message.content)).toEqual([
      expect.stringContaining("Scene"),
      "Alex: First turn.",
      "Alex: Newest turn.",
      expect.stringContaining("Roleplay at-depth lore."),
      expect.stringContaining("Continue the scene as Mara."),
    ]);
    expect(request.promptMessages[3].role).toBe("system");
  });
});
