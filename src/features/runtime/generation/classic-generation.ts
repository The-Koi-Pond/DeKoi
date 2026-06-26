import type { CharacterRecord } from "../../../engine/character";
import {
  appendClassicEntries,
  createGeneratedClassicEntry,
} from "../../../engine/classic-actions";
import type { ClassicThread } from "../../../engine/classic";
import type { LorebookRecord } from "../../../engine/lorebook";
import type { MessengerMessage, MessengerThread } from "../../../engine/messenger";
import type { PersonaRecord } from "../../../engine/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import type { MessengerGenerationRuntimeMode } from "./messenger-generation";
import { generateMessengerThreadReply } from "./messenger-generation";

export interface GenerateClassicThreadTurnInput {
  thread: ClassicThread;
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

export interface GenerateClassicThreadTurnResult {
  thread: ClassicThread;
  warnings: string[];
  generatedEntryCount: number;
}

function classicEntriesToMessengerMessages(
  thread: ClassicThread,
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

function classicThreadToMessengerThread(thread: ClassicThread): MessengerThread {
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
    messages: classicEntriesToMessengerMessages(thread),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function createClassicUserMessage({
  createId,
  now,
  thread,
}: {
  createId: (prefix: string) => string;
  now: string;
  thread: ClassicThread;
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
    id: createId("classic-generation-prompt"),
    threadId: thread.id,
    author: {
      kind: "system",
      label: "Classic",
    },
    body: "Continue this Classic chat with the next in-character turn.",
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export async function generateClassicThreadTurn({
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
}: GenerateClassicThreadTurnInput): Promise<GenerateClassicThreadTurnResult> {
  const messengerThread = classicThreadToMessengerThread(thread);
  const userMessage = createClassicUserMessage({ createId, now, thread });
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
      createGeneratedClassicEntry({
        companion,
        id: createId("classic-entry"),
        message,
        now: message.createdAt,
        thread,
      }),
    ];
  });

  return {
    thread:
      entries.length > 0
        ? appendClassicEntries(thread, entries, result.thread.updatedAt)
        : thread,
    warnings: result.warnings,
    generatedEntryCount: entries.length,
  };
}
