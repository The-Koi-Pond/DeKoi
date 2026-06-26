import type { CharacterRecord } from "../../../engine/character";
import {
  appendRoleplayEntries,
  createGeneratedRoleplayEntry,
} from "../../../engine/roleplay-actions";
import type { RoleplayThread } from "../../../engine/roleplay";
import type { LorebookRecord } from "../../../engine/lorebook";
import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerMessage,
  type MessengerThread,
} from "../../../engine/messenger";
import type { PersonaRecord } from "../../../engine/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import type { MessengerGenerationRuntimeMode } from "./messenger-generation";
import { generateMessengerThreadReply } from "./messenger-generation";

export interface GenerateRoleplayThreadTurnInput {
  thread: RoleplayThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  mode?: MessengerGenerationRuntimeMode;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createId: (prefix: string) => string;
}

export interface GenerateRoleplayThreadTurnResult {
  thread: RoleplayThread;
  warnings: string[];
  generatedEntryCount: number;
}

function roleplayEntriesToMessengerMessages(
  thread: RoleplayThread,
): MessengerMessage[] {
  return thread.entries.flatMap((entry): MessengerMessage[] => {
    if (entry.role === "character" && entry.characterId) {
      return [
        {
          id: `messenger-${entry.id}`,
          threadId: thread.id,
          author: {
            kind: "character",
            characterId: entry.characterId,
            label: entry.label,
          },
          body: entry.body,
          origin: entry.origin === "generated" ? "generated" : "manual",
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      ];
    }

    if (entry.role === "persona" && entry.personaId) {
      return [
        {
          id: `messenger-${entry.id}`,
          threadId: thread.id,
          author: {
            kind: "persona",
            personaId: entry.personaId,
            label: entry.label,
          },
          body: entry.body,
          origin: "manual",
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      ];
    }

    if (entry.role === "narration") {
      return [
        {
          id: `messenger-${entry.id}`,
          threadId: thread.id,
          author: {
            kind: "unknown",
            label: entry.label,
          },
          body: entry.body,
          origin: "manual",
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        },
      ];
    }

    return [];
  });
}

function roleplayThreadToMessengerThread(thread: RoleplayThread): MessengerThread {
  return {
    id: thread.id,
    schemaVersion: 1,
    kind: "messenger",
    mode: thread.characterIds.length > 1 ? "group" : "direct",
    title: thread.title,
    characterIds: thread.characterIds,
    activePersonaId: thread.activePersonaId,
    lorebookIds: thread.lorebookIds,
    presetId: null,
    providerConnectionId: thread.providerConnectionId,
    systemPromptMode: "default",
    systemPrompt: DEFAULT_MESSENGER_SYSTEM_PROMPT,
    messages: roleplayEntriesToMessengerMessages(thread),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function createRoleplayUserMessage({
  createId,
  now,
  thread,
}: {
  createId: (prefix: string) => string;
  now: string;
  thread: RoleplayThread;
}): MessengerMessage {
  const lastEntry = thread.entries.at(-1);
  if (lastEntry?.role === "persona" && lastEntry.personaId) {
    return {
      id: `messenger-${lastEntry.id}`,
      threadId: thread.id,
      author: {
        kind: "persona",
        personaId: lastEntry.personaId,
        label: lastEntry.label,
      },
      body: lastEntry.body,
      origin: "manual",
      createdAt: lastEntry.createdAt,
      updatedAt: lastEntry.updatedAt,
    };
  }

  if (lastEntry?.role === "narration") {
    return {
      id: `messenger-${lastEntry.id}`,
      threadId: thread.id,
      author: {
        kind: "unknown",
        label: lastEntry.label,
      },
      body: lastEntry.body,
      origin: "manual",
      createdAt: lastEntry.createdAt,
      updatedAt: lastEntry.updatedAt,
    };
  }

  return {
    id: createId("roleplay-generation-prompt"),
    threadId: thread.id,
    author: {
      kind: "system",
      label: "Roleplay",
    },
    body: "Continue this Roleplay chat with the next in-character turn.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export async function generateRoleplayThreadTurn({
  characters,
  createId,
  fallbackProviderConnectionId = null,
  lorebooks,
  mode = "mock",
  now,
  parameters,
  personas,
  providerConnections,
  thread,
}: GenerateRoleplayThreadTurnInput): Promise<GenerateRoleplayThreadTurnResult> {
  const messengerThread = roleplayThreadToMessengerThread(thread);
  const userMessage = createRoleplayUserMessage({ createId, now, thread });
  const result = await generateMessengerThreadReply({
    characters,
    createId,
    fallbackProviderConnectionId,
    lorebooks,
    mode,
    now,
    parameters,
    personas,
    providerConnections,
    thread: messengerThread,
    userMessage,
  });
  const entries = result.generatedMessages.flatMap((message) => {
    const author = message.author;
    if (author.kind !== "character") return [];

    const companion = characters.find(
      (character) => character.id === author.characterId,
    );
    if (!companion) return [];

    return [
      createGeneratedRoleplayEntry({
        companion,
        id: createId("roleplay-entry"),
        message,
        now: message.createdAt,
        thread,
      }),
    ];
  });

  return {
    thread:
      entries.length > 0
        ? appendRoleplayEntries(thread, entries, result.thread.updatedAt)
        : thread,
    warnings: result.warnings,
    generatedEntryCount: entries.length,
  };
}
