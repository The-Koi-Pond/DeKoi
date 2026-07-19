import { describe, expect, it } from "vitest";

import { createProviderConnectionRecord } from "../catalog/provider-connection-actions";
import type { PersonaRecord } from "../contracts/types/persona";
import type { LoreRuntimeState } from "../contracts/types/lore-runtime-state";
import type { ProviderConnectionProvider } from "../contracts/types/provider-connection";
import type { ModeMessage } from "../contracts/types/mode-thread";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { activateLorebookEntries } from "../generation-core/lorebook-activation";
import {
  activateLoreGenerationEntriesWithWarnings,
  createGenerationMacroContext,
  finalizeLoreGenerationRuntimeState,
  formatLoreGenerationEntries,
} from "./generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
  createMessengerGenerationRequestAssembly,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
} from "./roleplay-generation";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";
import {
  LOREBOOK_GENERATION_TEST_NOW as now,
  lorebookGenerationCharacter as character,
  messengerMessageFixture as messengerMessage,
  messengerThreadFixture as messengerThread,
  roleplayMessageFixture as roleplayMessage,
  roleplayThreadFixture as roleplayThread,
  selectiveLorebookFixture as selectiveLorebook,
} from "./lorebook-generation-wiring-fixtures";

function sequenceRandom(values: number[]) {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
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

function messengerCharacterMessage(
  id: string,
  characterId: string,
  label: string,
  body: string,
): ModeMessage {
  return createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: "messenger-thread-1",
    branchId: "messenger-thread-1-branch",
    author: { kind: "character", characterId, label },
    body,
    origin: "generated",
    now,
  });
}

function messengerPreset(messengerPrompt: string): PromptPresetRecord {
  return {
    id: "preset-1",
    schemaVersion: 2,
    name: "Messenger test",
    description: null,
    messengerPrompt,
    parameters: null,
    sectionOrder: [],
    groupOrder: [],
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

function roleplayCharacterMessage(
  id: string,
  characterId: string,
  label: string,
  body: string,
): ModeMessage {
  return createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: "roleplay-thread-1",
    branchId: "roleplay-thread-1-branch",
    author: { kind: "character", characterId, label },
    body,
    origin: "generated",
    now,
  });
}

describe("generation lorebook activation wiring", () => {
  it("filters Messenger selected lore from message scan sources", () => {
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: "preset-1",
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Did you see the canal?")],
    });
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Use literal /[bad/ text.")],
    });
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["city-lore"],
      presetId: "preset-1",
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "No matching key here.")],
    });
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Only the canal is here.")],
    });
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [
        messengerMessage("message-1", "Did you see the canal?"),
        messengerMessage("message-2", "   "),
      ],
    });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore", "lake-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "We should look for the grove.")],
    });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "Use literal /[bad/ text.")],
    });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["forest-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "No matching key here.")],
    });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["chat-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "Hello.")],
    });
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

    expect(context.requestThread.branches[0]?.lorebookIds).toEqual(["chat-lore"]);
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "Only the grove is here.")],
    });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "We should look for the grove.")],
    });
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

  it("counts macro-resolved lorebook summaries against the lore token budget", () => {
    const longCreatorNotes =
      "This companion description expands far beyond the raw summary macro and must consume the lore budget before the entry body is allowed.";
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "We should look for the grove.")],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [character({ creatorNotes: longCreatorNotes })],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "forest-lore",
          title: "Forest Lore",
          summary: "{{creatorNotes}}",
          activation: { budgetTokens: 30 },
          entries: [
            {
              id: "match",
              title: "Grove",
              body: "Ok.",
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

    expect(systemPrompt).not.toContain(longCreatorNotes);
    expect(systemPrompt).not.toContain("Forest Lore / Grove: Ok.");
  });

  it("counts macro-resolved lore entry bodies against the lore token budget", () => {
    const longCreatorNotes =
      "This companion description expands far beyond the raw entry macro and must not bypass the lore budget cap.";
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      presetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [character({ creatorNotes: longCreatorNotes })],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          activation: { budgetTokens: 12 },
          entries: [
            {
              id: "macro-body",
              title: "Macro Body",
              body: "{{creatorNotes}}",
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
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(promptText).not.toContain(longCreatorNotes);
    expect(promptText).not.toContain("City Lore / Macro Body");
  });

  it("uses macro-resolved lore bodies for recursive activation and inserted text", () => {
    const companion = character({
      description: "The moon gate opens when the canal bell rings.",
    });
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { recursiveScan: true },
      entries: [
        {
          id: "seed",
          title: "Seed",
          body: "{{description}}",
          input: { strategy: "constant" },
        },
        {
          id: "recursive",
          title: "Recursive",
          body: "The resolved seed entry unlocked this lore.",
          key: ["moon gate"],
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      companions: [companion],
      now,
      targetCompanion: companion,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        companions: [companion],
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["seed", "recursive"]);
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toContain(
      "City Lore / Seed: The moon gate opens when the canal bell rings.",
    );
  });

  it("does not recurse through random or roll activation previews", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { recursiveScan: true },
      entries: [
        {
          id: "random-seed",
          title: "Random Seed",
          body: "{{random::hidden-random::}}",
          input: { strategy: "constant" },
        },
        {
          id: "roll-seed",
          title: "Roll Seed",
          body: "roll {{roll:1d6}}",
          input: { strategy: "constant" },
        },
        {
          id: "hidden-random",
          title: "Hidden Random",
          body: "Random preview leaked into recursion.",
          key: ["hidden-random"],
        },
        {
          id: "hidden-roll",
          title: "Hidden Roll",
          body: "Roll preview leaked into recursion.",
          key: ["roll 1"],
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["random-seed", "roll-seed"]);
    expect(
      formatLoreGenerationEntries(result.entries, {
        macroContext,
        macroOptions: { random: sequenceRandom([0.999, 0.999]) },
      }),
    ).toEqual(["City Lore / Roll Seed: roll 6"]);
  });

  it("keeps macro lore bodies that resolve after prompt variables", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "delayed",
          title: "Delayed",
          body: "{{getvar::mood}}",
          input: { strategy: "constant", insertionPosition: "after-character" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["delayed"]);
    macroContext.variables.mood = "calm";
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Delayed: calm",
    ]);
  });

  it("commits only kept visible lore variable mutations", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{setvar::summarySeen::1}}",
      title: "City Lore",
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: "{{setvar::leaked::bad}}Dropped",
          key: ["absent"],
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{setvar::kept::yes}}Kept {{kept}} {{getvar::leaked}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        includeSummary: true,
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["kept"]);
    expect(
      formatLoreGenerationEntries(result.entries, { includeSummary: true, macroContext }),
    ).toEqual(["City Lore / Kept: Kept yes"]);
    expect(macroContext.variables).toEqual({ kept: "yes" });
  });

  it("resolves kept lore variable mutations in prompt order", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{addvar::count::1}}Summary {{getvar::count}}",
      title: "City Lore",
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: "{{setvar::count::999}}Dropped",
          key: ["absent"],
        },
        {
          id: "first",
          title: "First",
          body: "{{incvar::count}}First {{getvar::count}}",
          input: { strategy: "constant" },
        },
        {
          id: "second",
          title: "Second",
          body: "Second saw [{{getvar::count}}]{{incvar::count}} now {{getvar::count}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        includeSummary: true,
        macroContext,
        scanSources: [],
      },
    );

    const formatted = formatLoreGenerationEntries(result.entries, {
      includeSummary: true,
      macroContext,
    });

    expect(formatted).toEqual([
      "City Lore: Summary 1",
      "City Lore / First: First 2",
      "City Lore / Second: Second saw [2] now 3",
    ]);
    expect(macroContext.variables).toEqual({ count: "3" });
    expect(() =>
      formatLoreGenerationEntries(result.entries, { includeSummary: true, macroContext }),
    ).toThrow("Cannot format lore macro text more than once with the same macro context.");
    expect(macroContext.variables).toEqual({ count: "3" });
  });

  it("rejects stale lore macro formatting after a summary toggle", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{setvar::summaryFlag::yes}}Summary",
      title: "City Lore",
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "Body sees {{getvar::summaryFlag}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: Body sees",
    ]);
    expect(() =>
      formatLoreGenerationEntries(result.entries, { includeSummary: true, macroContext }),
    ).toThrow("Cannot format lore macro text more than once with the same macro context.");
    expect(macroContext.variables).toEqual({});
  });

  it("preserves summary variable mutations until summaries are emitted", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{setvar::summaryFlag::yes}}Summary",
      title: "City Lore",
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "Body sees {{getvar::summaryFlag}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(result.entries, { includeSummary: true, macroContext }),
    ).toEqual(["City Lore: Summary", "City Lore / Kept: Body sees yes"]);
    expect(macroContext.variables).toEqual({ summaryFlag: "yes" });
  });

  it("budgets kept lore text at its formatting point", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{setvar::detail::This detail is much too long for the lore budget.}}Seed",
      title: "City Lore",
      activation: { budgetTokens: 12 },
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "{{getvar::detail}}Ok",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        includeSummary: true,
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(result.entries, { includeSummary: true, macroContext }),
    ).toEqual([]);
    expect(macroContext.variables).toEqual({});
  });

  it("recomputes lore budget previews after prompt-order variable commits", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 11 },
      entries: [
        {
          id: "first",
          title: "First",
          body: "{{setvar::routeFlag::short}}A",
          input: { strategy: "constant" },
        },
        {
          id: "second",
          title: "Second",
          body: "{{#if routeFlag}}B{{else}}This hidden fallback is deliberately long enough to exceed the lore budget before the first entry commits its variable.{{/if}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / First: A",
      "City Lore / Second: B",
    ]);
    expect(macroContext.variables).toEqual({ routeFlag: "short" });
  });

  it("budgets random lore previews by resolved option length", () => {
    const companion = character({
      description:
        "The archived canal oath is deliberately long enough to exceed the preview budget when resolved.",
    });
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 10 },
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "{{random::{{description}}::short literal text}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      companions: [companion],
      now,
      targetCompanion: companion,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        companions: [companion],
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(result.entries, {
        macroContext,
        macroOptions: { random: sequenceRandom([0]) },
      }),
    ).toEqual([]);
  });

  it("budgets bare random lore previews conservatively", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 6 },
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "{{random}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(result.entries, {
        macroContext,
        macroOptions: { random: sequenceRandom([1]) },
      }),
    ).toEqual([]);
  });

  it("samples random lore macros only when kept lore is emitted", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "inactive",
          title: "Inactive",
          body: "{{random::hidden-left::hidden-right}}",
          key: ["absent"],
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.9, 0.1]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: visible-right",
    ]);
  });

  it("does not sample random lore macros from budget-dropped entries", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 12 },
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: "{{random::ok::This hidden branch is much too long for the lore budget and should be dropped before sampling.}}",
          input: { strategy: "constant" },
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.9, 0.1]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: visible-right",
    ]);
  });

  it("budgets random previews against downstream variable effects", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 16 },
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: "{{random::{{setvar::tail::tiny}}longer::short}}{{getvar::tail}}",
          input: { strategy: "constant" },
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
      variables: {
        tail: "this downstream variable text is too long for the lore budget",
      },
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.9, 0.1]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: visible-right",
    ]);
    expect(macroContext.variables.tail).toBe(
      "this downstream variable text is too long for the lore budget",
    );
  });

  it("budgets nested random previews against enclosing variable effects", () => {
    const longTail =
      "this enclosing variable text is too long for the lore budget after random resolution";
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 16 },
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: `{{#if {{random::longer::{{setvar::tail::${longTail}}}x}}}}ok{{/if}}{{getvar::tail}}`,
          input: { strategy: "constant" },
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
      variables: { tail: "tiny" },
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.9, 0.1]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: visible-right",
    ]);
    expect(macroContext.variables.tail).toBe("tiny");
  });

  it("budgets random structural previews by restored text length", () => {
    const longBranch =
      "This unresolved structural branch is deliberately long enough to exceed the budget preview.";
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 10 },
      entries: [
        {
          id: "dropped",
          title: "Dropped",
          body: `{{random::{{#if {{getvar::loop}}}}${longBranch}{{/if}}::short}}`,
          input: { strategy: "constant" },
        },
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
      variables: { loop: "{{#if loop}}blocked{{/if}}" },
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(result.entries, {
        macroContext,
        macroOptions: { random: sequenceRandom([0.1, 0.9]) },
      }),
    ).toEqual(["City Lore / Kept: visible-left"]);
  });

  it("keeps macro lore budget priority before prompt insertion order", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 8, recursiveScan: true },
      entries: [
        {
          id: "direct-constant",
          title: "C",
          body: "C",
          input: {
            insertionOrder: 0,
            strategy: "constant",
          },
        },
        {
          id: "direct-selective",
          title: "S",
          body: "S",
          key: ["gate"],
          input: {
            insertionOrder: 200,
          },
        },
        {
          id: "recursive-constant",
          title: "R",
          body: "R",
          input: {
            insertionOrder: 300,
            recursion: {
              delayUntilRecursion: true,
              nonRecursable: false,
              preventFurther: false,
              recursionLevel: 0,
            },
            strategy: "constant",
          },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [{ body: "gate" }],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual([
      "recursive-constant",
      "direct-selective",
      "direct-constant",
    ]);
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / S: S",
      "City Lore / C: C",
    ]);
  });

  it("reserves same-rank macro lore budget by insertion priority across prompt positions", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 10 },
      entries: [
        {
          id: "lower-before",
          title: "Low",
          body: "L",
          input: {
            insertionOrder: 10,
            insertionPosition: "before-character",
            strategy: "constant",
          },
        },
        {
          id: "higher-after",
          title: "High",
          body: "{{getvar::expanded}}",
          input: {
            insertionOrder: 100,
            insertionPosition: "after-character",
            strategy: "constant",
          },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(
        result.entries.filter((entry) => entry.entry.insertionPosition === "before-character"),
        { macroContext },
      ),
    ).toEqual([]);

    macroContext.variables.expanded = "Expanded tail";

    expect(
      formatLoreGenerationEntries(
        result.entries.filter((entry) => entry.entry.insertionPosition === "after-character"),
        { macroContext },
      ),
    ).toEqual(["City Lore / High: Expanded tail"]);
  });

  it("does not sample random summary macros when summaries are omitted", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      summary: "{{random::hidden-left::hidden-right}}",
      title: "City Lore",
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "{{random::visible-left::visible-right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.9, 0.1]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: visible-right",
    ]);
  });

  it("reuses sampled kept lore text during repeated formatting", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "kept",
          title: "Kept",
          body: "{{setvar::mood::{{random::calm::wild}}}}Mood {{getvar::mood}} and {{random::left::right}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        macroOptions: { random: sequenceRandom([0.1, 0.1, 0.9, 0.9]) },
        scanSources: [],
      },
    );

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Kept: Mood calm and left",
    ]);
    expect(macroContext.variables).toEqual({ mood: "calm" });
  });

  it("rejects stale formatting after a macro lore body resolves empty", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "mutable",
          title: "Mutable",
          body: "{{setvar::dropped::bad}}{{getvar::bodyText}}",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });
    macroContext.variables.bodyText = "Visible";

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["mutable"]);
    macroContext.variables.bodyText = "";
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([]);
    expect(macroContext.variables).toEqual({ bodyText: "" });

    macroContext.variables.bodyText = "Visible again";
    expect(() => formatLoreGenerationEntries(result.entries, { macroContext })).toThrow(
      "Cannot format lore macro text more than once with the same macro context.",
    );
    expect(macroContext.variables).toEqual({ bodyText: "Visible again" });
  });

  it("does not activate timers for macro-empty lore bodies", () => {
    const companion = character({ creatorNotes: "" });
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "empty",
          title: "Empty",
          body: "{{creatorNotes}}{{// hidden lore }}",
          input: {
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
      ],
    });
    const runtimeState = {
      id: "lore-runtime-1",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: "messenger-thread-1-branch",
      lastEvaluatedMessageCount: 0,
      entries: [],
      createdAt: now,
      updatedAt: now,
    } satisfies LoreRuntimeState;
    const macroContext = createGenerationMacroContext({
      companions: [companion],
      now,
      targetCompanion: companion,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        companions: [companion],
        macroContext,
        runtimeState,
        scanSources: [{ name: "Alex", body: "Hello." }],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["empty"]);
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([]);
    expect(finalizeLoreGenerationRuntimeState(result)?.entries).toEqual([]);
  });

  it("clears macro lore runtime timers from budget-dropped activation results", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { budgetTokens: 0 },
      entries: [
        {
          id: "timed",
          title: "Timed",
          body: "Timed lore.",
          input: {
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
      ],
    });
    const runtimeState = {
      id: "lore-runtime-1",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: "messenger-thread-1-branch",
      lastEvaluatedMessageCount: 0,
      entries: [
        {
          lorebookId: lorebook.id,
          entryId: "timed",
          entryUpdatedAt: now,
          activatedAtMessageIndex: 0,
          stickyRemaining: 2,
          cooldownRemaining: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
    } satisfies LoreRuntimeState;
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        runtimeState,
        scanSources: [{ body: "Hello." }],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual(["timed"]);
    expect(result.runtimeState?.entries).toMatchObject([
      {
        stickyRemaining: 1,
        cooldownRemaining: 0,
      },
    ]);
    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([]);
    expect(finalizeLoreGenerationRuntimeState(result)?.entries).toEqual([]);
  });

  it("keeps macro activation runtime state stable until explicit finalization", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "timed",
          title: "Timed",
          body: "Timed lore.",
          input: {
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
      ],
    });
    const runtimeState = {
      id: "lore-runtime-1",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: "messenger-thread-1-branch",
      lastEvaluatedMessageCount: 0,
      entries: [],
      createdAt: now,
      updatedAt: now,
    } satisfies LoreRuntimeState;
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        runtimeState,
        scanSources: [{ body: "Hello." }],
      },
    );
    const runtimeStateBeforeFormatting = result.runtimeState;

    expect(formatLoreGenerationEntries(result.entries, { macroContext })).toEqual([
      "City Lore / Timed: Timed lore.",
    ]);
    expect(result.runtimeState).toBe(runtimeStateBeforeFormatting);
    expect(result.runtimeState?.entries).toEqual([]);
    expect(finalizeLoreGenerationRuntimeState(result)?.entries).toMatchObject([
      {
        entryId: "timed",
        stickyRemaining: 2,
        cooldownRemaining: 1,
      },
    ]);
  });

  it("rejects macro lore runtime finalization before every activation settles", () => {
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "before",
          title: "Before",
          body: "Before lore.",
          input: {
            insertionPosition: "before-character",
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
        {
          id: "after",
          title: "After",
          body: "After lore.",
          input: {
            insertionPosition: "after-character",
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(
      formatLoreGenerationEntries(
        result.entries.filter((entry) => entry.entry.insertionPosition === "before-character"),
        { macroContext },
      ),
    ).toEqual(["City Lore / Before: Before lore."]);
    expect(() => finalizeLoreGenerationRuntimeState(result)).toThrow(
      "Cannot finalize lore runtime state before formatting all macro-activated lore entries.",
    );
  });

  it("clears stale timers when macro-resolved lore bodies are empty", () => {
    const companion = character({ creatorNotes: "" });
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      entries: [
        {
          id: "empty",
          title: "Empty",
          body: "{{creatorNotes}}{{// hidden lore }}",
          input: {
            strategy: "constant",
            timing: { delay: 0, sticky: 2, cooldown: 1 },
          },
        },
      ],
    });
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: [companion.id],
      activePersonaId: null,
      lorebookIds: [lorebook.id],
      presetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const runtimeState = {
      id: "lore-runtime-1",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: thread.activeBranchId,
      lastEvaluatedMessageCount: 0,
      entries: [
        {
          lorebookId: lorebook.id,
          entryId: "empty",
          entryUpdatedAt: now,
          activatedAtMessageIndex: 0,
          stickyRemaining: 2,
          cooldownRemaining: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
    } satisfies LoreRuntimeState;
    const context = createMessengerGenerationContext({
      thread,
      characters: [companion],
      personas: [],
      lorebooks: [lorebook],
    });

    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      loreRuntimeState: runtimeState,
      now,
      userMessage: thread.messages[0],
    });

    expect(assembly.request.promptMessages[0].content).not.toContain("City Lore / Empty");
    expect(assembly.loreRuntimeState?.entries).toEqual([]);
  });

  it("resolves companion and persona match-source fields before activation", () => {
    const companion = character({
      creatorNotes: "canal sigil",
      description: "{{creatorNotes}}",
    });
    const activePersona = persona({
      description: "Follows {{char}} through the lantern route.",
    });
    const lorebook = selectiveLorebook({
      id: "city-lore",
      title: "City Lore",
      activation: { matchWholeWords: false },
      entries: [
        {
          id: "character-source",
          title: "Character Source",
          body: "Character source activated.",
          key: ["canal sigil"],
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
          body: "Persona source activated.",
          key: ["Mara"],
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
    });
    const macroContext = createGenerationMacroContext({
      activePersona,
      companions: [companion],
      now,
      targetCompanion: companion,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        activePersona,
        companions: [companion],
        macroContext,
        scanSources: [],
      },
    );

    expect(result.entries.map((entry) => entry.entry.id)).toEqual([
      "character-source",
      "persona-source",
    ]);
  });

  it("emits a Roleplay lorebook summary once when entries use multiple positions", () => {
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      openingCharacter: null,
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "We should look for the grove.")],
    });
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

  it("rejects macro-context formatting for unresolved raw lore entries", () => {
    const activated = activateLorebookEntries(
      selectiveLorebook({
        id: "forest-lore",
        title: "Forest Lore",
        summary: "{{setvar::summary::hidden}}Hidden summary",
        entries: [
          {
            id: "match",
            title: "Grove",
            body: "{{setvar::body::visible}}The hidden grove opens at sunset.",
            key: ["grove"],
          },
        ],
      }),
      "grove",
    );
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    expect(() =>
      formatLoreGenerationEntries(activated, {
        includeSummary: false,
        macroContext,
      }),
    ).toThrow("Cannot format unresolved lore entries with a macro context.");
    expect(macroContext.variables).toEqual({});
  });

  it("rejects raw formatting for macro-activated lore entries", () => {
    const lorebook = selectiveLorebook({
      id: "forest-lore",
      title: "Forest Lore",
      entries: [
        {
          id: "match",
          title: "Grove",
          body: "The hidden grove opens at sunset.",
          input: { strategy: "constant" },
        },
      ],
    });
    const macroContext = createGenerationMacroContext({
      now,
      threadId: "messenger-thread-1",
    });

    const result = activateLoreGenerationEntriesWithWarnings(
      {
        chat: [lorebook],
        persona: [],
        character: [],
        global: [],
      },
      {
        macroContext,
        scanSources: [],
      },
    );

    expect(() => formatLoreGenerationEntries(result.entries)).toThrow(
      "Cannot format macro-activated lore entries without a macro context.",
    );
  });

  it("routes Messenger lore around character context by insertion position", () => {
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Did you see the canal?")],
    });
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

  it("makes Messenger character variables visible to following lore", () => {
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "{{setvar::mood::calm}}A steady companion.",
        }),
      ],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          entries: [
            {
              id: "after",
              title: "After",
              body: "After-character lore sees {{getvar::mood}}.",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
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

    expect(request.promptMessages[0].content).toContain(
      "City Lore / After: After-character lore sees calm.",
    );
  });

  it("budgets Messenger after-character lore after character variables resolve", () => {
    const longDetail =
      "This detail expands after character context and must still be counted before lore emits.";
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: `{{setvar::detail::${longDetail}}}A steady companion.`,
        }),
      ],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          activation: { budgetTokens: 8 },
          entries: [
            {
              id: "after",
              title: "After",
              body: "Ok {{getvar::detail}}",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
                timing: { cooldown: 1, delay: 0, sticky: 2 },
              },
            },
          ],
        }),
      ],
    });
    const runtimeState = {
      id: "lore-runtime-1",
      schemaVersion: 1,
      ownerKind: "mode-branch",
      ownerId: "messenger-thread-1-branch",
      lastEvaluatedMessageCount: 0,
      entries: [],
      createdAt: now,
      updatedAt: now,
    } satisfies LoreRuntimeState;

    const assembly = createMessengerGenerationRequestAssembly({
      context,
      id: "request-1",
      loreRuntimeState: runtimeState,
      now,
      userMessage: thread.messages[0],
    });
    const request = assembly.request;
    const systemPrompt = request.promptMessages[0].content;

    expect(systemPrompt).toContain("Description: A steady companion.");
    expect(systemPrompt).not.toContain("City Lore / After");
    expect(systemPrompt).not.toContain(longDetail);
    expect(assembly.loreRuntimeState?.entries).toEqual([]);
  });

  it("does not pre-drop Messenger lore that shrinks after character variables resolve", () => {
    const longDetail =
      "This activation-time detail is deliberately too long for the lore budget before the character block replaces it.";
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "{{setvar::detail::ok}}A steady companion.",
        }),
      ],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          activation: { budgetTokens: 6 },
          entries: [
            {
              id: "after",
              title: "After",
              body: "{{getvar::detail}}",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
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

    expect(systemPrompt).toContain("Description: A steady companion.");
    expect(systemPrompt).toContain("City Lore / After: ok");
    expect(systemPrompt).not.toContain(longDetail);
  });

  it("keeps higher-priority Messenger lore when later variables expand its budget cost", () => {
    const detail = "expanded detail still fits by itself";
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: `{{setvar::detail::${detail}}}A steady companion.`,
        }),
      ],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          activation: { budgetTokens: 15 },
          entries: [
            {
              id: "before-low",
              title: "B",
              body: "L",
              key: ["Hello"],
              input: {
                insertionPosition: "before-character",
              },
            },
            {
              id: "after-high",
              title: "A",
              body: "Ok {{getvar::detail}}",
              input: {
                insertionPosition: "after-character",
                strategy: "constant",
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

    expect(systemPrompt).not.toContain("City Lore / B: L");
    expect(systemPrompt).toContain(`City Lore / A: Ok ${detail}`);
  });

  it("resolves macros across Messenger prompt assembly surfaces", () => {
    const connection = providerConnection("openai");
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["city-lore"],
      presetId: "preset-1",
      providerConnectionId: connection.id,
      messages: [messengerMessage("message-1", "  Canal please.  ")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "Field macro sees {{user}} via {{model}}.",
          characterNote: "Unknown stays {{literalCharacter}}.",
          postHistoryInstructions: "Keep {{input}} for {{char}}.",
        }),
      ],
      personas: [
        persona({
          displayName: "  Alex  ",
          description: "Persona field sees {{char}} after {{input}}.",
          postHistoryInstructions: "Persona remembers {{chatId}} and {{isotime}}.",
        }),
      ],
      lorebooks: [
        selectiveLorebook({
          id: "city-lore",
          title: "City Lore",
          summary: "Summary for {{user}}.",
          entries: [
            {
              id: "before",
              title: "Before",
              body: "Before lore for {{char}} and {{persona}}.",
              input: {
                strategy: "constant",
                insertionPosition: "before-character",
              },
            },
            {
              id: "after",
              title: "After",
              body: "After lore keeps literal {{unknownLore}} for {{user}}.",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
              },
            },
            {
              id: "depth",
              title: "Depth",
              body: "Depth lore sees {{model}} and {{chatId}}.",
              input: {
                strategy: "constant",
                insertionPosition: "at-depth",
                depth: 0,
                role: "user",
              },
            },
          ],
        }),
      ],
      providerConnections: [connection],
      promptPresets: [
        messengerPreset(
          "Custom {{char}}/{{user}}/{{input}}/{{model}}/{{chatId}}/{{isotime}} {{unknownMacro}} {{// hidden}}",
        ),
      ],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[0],
    });
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(promptText).toContain(
      "Custom Mara/Alex/Canal please./test-model/messenger-thread-1/2026-07-02T00:00:00.000Z {{unknownMacro}}",
    );
    expect(promptText).not.toContain("hidden");
    expect(promptText).toContain("Description: Field macro sees Alex via test-model.");
    expect(promptText).toContain("Character note: Unknown stays {{literalCharacter}}.");
    expect(promptText).toContain("Description: Persona field sees Mara after Canal please.");
    expect(promptText).toContain("Before lore for Mara and Alex.");
    expect(promptText).toContain("After lore keeps literal {{unknownLore}} for Alex.");
    expect(promptText).toContain("Depth lore sees test-model and messenger-thread-1.");
    expect(promptText).toContain("Post-history instructions\nKeep Canal please. for Mara.");
    expect(promptText).toContain(
      "Persona post-history instructions\nPersona remembers messenger-thread-1 and 2026-07-02T00:00:00.000Z.",
    );
  });

  it("resolves Messenger post-history macros after persona and companion sections", () => {
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: [],
      presetId: "preset-1",
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "Companion mood before post {{getvar::postMood}}.",
          postHistoryInstructions: "{{setvar::postMood::late}}Post mood {{getvar::postMood}}.",
        }),
      ],
      personas: [
        persona({
          description: "Persona mood before post {{getvar::postMood}}.",
        }),
      ],
      lorebooks: [],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[0],
    });
    const systemPrompt = request.promptMessages[0].content;

    expect(systemPrompt).toContain("Description: Persona mood before post .");
    expect(systemPrompt).toContain("Description: Companion mood before post .");
    expect(systemPrompt).toContain("Post-history instructions\nPost mood late.");
    expect(systemPrompt).not.toContain("before post late");
    expect(systemPrompt.indexOf("Description: Companion mood before post .")).toBeLessThan(
      systemPrompt.indexOf("Post-history instructions"),
    );
  });

  it("applies Messenger lore variable side effects in prompt insertion order", () => {
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["order-lore"],
      presetId: "preset-1",
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          description: "Character mood {{getvar::loreMood}}.",
          postHistoryInstructions: "Post mood {{getvar::loreMood}}.",
        }),
      ],
      personas: [
        persona({
          description: "Persona mood {{getvar::loreMood}}.",
        }),
      ],
      promptPresets: [
        messengerPreset("{{setvar::loreMood::system}}System mood {{getvar::loreMood}}."),
      ],
      lorebooks: [
        selectiveLorebook({
          id: "order-lore",
          title: "Order Lore",
          entries: [
            {
              id: "before",
              title: "Before",
              body: "Before lore saw {{getvar::loreMood}} then {{setvar::loreMood::before}}{{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "before-character" },
            },
            {
              id: "after",
              title: "After",
              body: "{{setvar::loreMood::after}}After lore {{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "after-character" },
            },
            {
              id: "depth",
              title: "Depth",
              body: "{{setvar::loreMood::depth}}Depth lore {{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "at-depth", depth: 0 },
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

    expect(systemPrompt).toContain("Before lore saw system then before.");
    expect(systemPrompt).toContain("Description: Persona mood before.");
    expect(systemPrompt).toContain("Description: Character mood before.");
    expect(systemPrompt).toContain("After lore after.");
    expect(systemPrompt).toContain("Post-history instructions\nPost mood after.");
    expect(systemPrompt).not.toContain("mood depth");
    expect(request.promptMessages.map((message) => message.content)).toEqual(
      expect.arrayContaining([expect.stringContaining("Depth lore depth.")]),
    );
  });

  it("resolves character macros for the selected Messenger group speaker", () => {
    const userMessage = messengerMessage("message-2", "Your turn.");
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1", "character-2"],
      activePersonaId: "persona-1",
      lorebookIds: [],
      presetId: "preset-1",
      providerConnectionId: null,
      messages: [
        messengerCharacterMessage("message-1", "character-1", "Mara", "First reply."),
        userMessage,
      ],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [
        character({
          id: "character-1",
          displayName: "Mara",
          creatorNotes: "Mara hidden creator notes.",
        }),
        character({
          id: "character-2",
          displayName: "Koi",
          creatorNotes: "Koi selected creator notes.",
        }),
      ],
      personas: [persona()],
      lorebooks: [],
      promptPresets: [
        messengerPreset(
          '{{#if char == "Koi"}}Speaker {{char}}: {{creatorNotes}}{{else}}Wrong speaker {{char}}: {{creatorNotes}}{{/if}}',
        ),
      ],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage,
    });
    const systemPrompt = request.promptMessages[0].content;

    expect(request.targetCharacterId).toBe("character-2");
    expect(systemPrompt).toContain("Speaker Koi: Koi selected creator notes.");
    expect(systemPrompt).not.toContain("Wrong speaker");
    expect(systemPrompt).not.toContain("Mara hidden creator notes.");
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["chat-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Hello.")],
    });
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

    expect(context.requestThread.branches[0]?.lorebookIds).toEqual(["chat-lore"]);
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [
        messengerMessage("message-1", "First turn."),
        messengerMessage("message-2", "Newest turn."),
      ],
    });
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
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Thread",
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["city-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: connection.id,
      messages: [
        messengerMessage("message-1", "First turn."),
        messengerMessage("message-2", "Newest turn."),
      ],
    });
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
      const thread = messengerThread({
        id: "messenger-thread-1",
        title: "Thread",
        characterIds: ["character-1"],
        activePersonaId: null,
        lorebookIds: ["city-lore"],
        defaultPromptPresetId: null,
        providerConnectionId: connection.id,
        messages: [
          messengerMessage("message-1", "First turn."),
          messengerMessage("message-2", "Newest turn."),
        ],
      });
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
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      openingCharacter: null,
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [
        roleplayMessage("entry-1", "First turn."),
        roleplayMessage("entry-2", "Newest turn."),
      ],
    });
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

  it("makes Roleplay character variables visible to following lore", () => {
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene",
      openingCharacter: null,
      characterIds: ["character-1"],
      activePersonaId: null,
      lorebookIds: ["forest-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "Start.")],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [
        character({
          description: "{{setvar::sceneMood::focused}}Ready for the scene.",
        }),
      ],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "forest-lore",
          title: "Forest Lore",
          summary: "",
          entries: [
            {
              id: "after",
              title: "After",
              body: "After-character lore sees {{getvar::sceneMood}}.",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
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

    expect(request.promptMessages[0].content).toContain(
      "Forest Lore / After: After-character lore sees focused.",
    );
  });

  it("resolves macros across Roleplay prompt assembly surfaces", () => {
    const connection = providerConnection("openai");
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Scene for {{char}}",
      openingCharacter: null,
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["forest-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: connection.id,
      messages: [roleplayMessage("entry-1", "  Open the gate.  ")],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [
        character({
          description: "Trusts {{user}} near {{input}}.",
          personality: "Says {{unknownPersonality}} plainly.",
          exampleMessages: "Mara: {{user}} brought {{input}}.",
          postHistoryInstructions: "Character says {{input}} to {{user}}.",
        }),
      ],
      personas: [
        persona({
          description: "Persona sees {{char}} with {{model}}.",
          postHistoryInstructions: "Persona says {{char}} should answer {{input}}.",
        }),
      ],
      lorebooks: [
        selectiveLorebook({
          id: "forest-lore",
          title: "Forest Lore",
          summary: "Forest summary for {{char}}.",
          entries: [
            {
              id: "before",
              title: "Before",
              body: "Before roleplay lore for {{char}} and {{user}}.",
              input: {
                strategy: "constant",
                insertionPosition: "before-character",
              },
            },
            {
              id: "after",
              title: "After",
              body: "After roleplay lore for {{persona}} using {{model}}.",
              input: {
                strategy: "constant",
                insertionPosition: "after-character",
              },
            },
            {
              id: "depth",
              title: "Depth",
              body: "Depth roleplay lore sees {{chatId}} and {{input}}.",
              input: {
                strategy: "constant",
                insertionPosition: "at-depth",
                depth: 0,
                role: null,
              },
            },
            {
              id: "comment-only",
              title: "Comment Only",
              body: "{{// hidden lore }}",
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

    const request = createRoleplayGenerationRequest({
      context,
      id: "request-1",
      now,
    });
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");
    const postHistoryPrompt = request.promptMessages[request.promptMessages.length - 1].content;

    expect(promptText).toContain(
      "You are Mara, writing the next in-character turn in an ongoing fictional roleplay with Alex.",
    );
    expect(promptText).not.toContain("{{char}}");
    expect(promptText).not.toContain("{{user}}");
    expect(promptText).toContain("Title: Scene for Mara");
    expect(promptText).not.toContain("Scene setup mentions");
    expect(promptText).toContain("Forest Lore: Forest summary for Mara.");
    expect(promptText).toContain("Description: Trusts Alex near Open the gate.");
    expect(promptText).toContain("Personality: Says {{unknownPersonality}} plainly.");
    expect(promptText).toContain("Description: Persona sees Mara with test-model.");
    expect(promptText).toContain("Mara: Alex brought Open the gate.");
    expect(promptText).toContain("Before roleplay lore for Mara and Alex.");
    expect(promptText).toContain("After roleplay lore for Alex using test-model.");
    expect(promptText).toContain("Depth roleplay lore sees roleplay-thread-1 and Open the gate.");
    expect(promptText).not.toContain("Comment Only:");
    expect(postHistoryPrompt).toContain("Continue the scene as Mara.");
    expect(postHistoryPrompt).toContain(
      "Character post-history instructions: Character says Open the gate. to Alex.",
    );
    expect(postHistoryPrompt).toContain(
      "Persona post-history instructions: Persona says Mara should answer Open the gate.",
    );
  });

  it("applies Roleplay lore variable side effects in prompt insertion order", () => {
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "{{setvar::sceneMood::title}}Scene mood {{getvar::sceneMood}}",
      openingCharacter: null,
      characterIds: ["character-1"],
      activePersonaId: "persona-1",
      lorebookIds: ["order-lore"],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [roleplayMessage("entry-1", "Open the gate.")],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [
        character({
          description: "Character mood {{getvar::loreMood}}.",
          postHistoryInstructions: "Post mood {{getvar::loreMood}}.",
        }),
      ],
      personas: [
        persona({
          description: "Persona mood {{getvar::loreMood}}.",
        }),
      ],
      lorebooks: [
        selectiveLorebook({
          id: "order-lore",
          title: "Order Lore",
          entries: [
            {
              id: "before",
              title: "Before",
              body: "Before roleplay lore saw {{getvar::sceneMood}} then {{setvar::loreMood::before}}{{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "before-character" },
            },
            {
              id: "after",
              title: "After",
              body: "{{setvar::loreMood::after}}After roleplay lore {{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "after-character" },
            },
            {
              id: "depth-tail",
              title: "Depth Tail",
              body: "{{setvar::loreMood::depth-tail}}Depth roleplay tail {{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "at-depth", depth: 0 },
            },
            {
              id: "depth-before",
              title: "Depth Before",
              body: "{{setvar::loreMood::depth-before}}Depth roleplay before {{getvar::loreMood}}.",
              input: { strategy: "constant", insertionPosition: "at-depth", depth: 1 },
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
    const postHistoryPrompt = request.promptMessages[request.promptMessages.length - 1].content;

    expect(systemPrompt).toContain("Title: Scene mood title");
    expect(systemPrompt).toContain("Before roleplay lore saw title then before.");
    expect(systemPrompt).toContain("Description: Persona mood before.");
    expect(systemPrompt).toContain("Description: Character mood before.");
    expect(systemPrompt).toContain("After roleplay lore after.");
    expect(systemPrompt).not.toContain("mood depth");
    expect(request.promptMessages.map((message) => message.content)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Depth roleplay before depth-before."),
        expect.stringContaining("Depth roleplay tail depth-tail."),
      ]),
    );
    expect(postHistoryPrompt).toContain(
      "Character post-history instructions: Post mood depth-tail.",
    );
  });

  it("resolves character macros for the selected Roleplay companion", () => {
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: '{{#if char == "Koi"}}Koi scene{{else}}Wrong scene{{/if}}',
      openingCharacter: null,
      characterIds: ["character-1", "character-2"],
      activePersonaId: "persona-1",
      lorebookIds: [],
      defaultPromptPresetId: null,
      providerConnectionId: null,
      messages: [
        roleplayCharacterMessage("entry-1", "character-1", "Mara", "First turn."),
        roleplayMessage("entry-2", "Continue."),
      ],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [
        character({
          id: "character-1",
          displayName: "Mara",
          creatorNotes: "Mara hidden creator notes.",
        }),
        character({
          id: "character-2",
          displayName: "Koi",
          creatorNotes: "Koi selected creator notes.",
        }),
      ],
      personas: [persona()],
      lorebooks: [],
    });

    const request = createRoleplayGenerationRequest({
      context,
      id: "request-1",
      now,
    });
    const promptText = request.promptMessages.map((message) => message.content).join("\n\n");

    expect(request.targetCharacterId).toBe("character-2");
    expect(promptText).toContain(
      "You are Koi, writing the next in-character turn in an ongoing fictional roleplay with Alex.",
    );
    expect(promptText).toContain("Title: Koi scene");
    expect(promptText).not.toContain("Scene anchor:");
    expect(promptText).not.toContain("Wrong scene");
    expect(promptText).not.toContain("Mara hidden creator notes.");
  });
});
