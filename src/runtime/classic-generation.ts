import type { CharacterRecord } from "../engine/character";
import {
  appendClassicEntries,
  createGeneratedClassicEntry,
} from "../engine/classic-actions";
import type { ClassicThread } from "../engine/classic";
import type { LorebookRecord } from "../engine/lorebook";
import type { MessengerMessage, MessengerThread } from "../engine/messenger";
import type { PersonaRecord } from "../engine/persona";
import type { ProviderConnectionRecord } from "../engine/provider-connection";
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

function createClassicScenePrompt(thread: ClassicThread) {
  const sceneText = thread.sceneText.trim() || "Continue this Classic scene.";
  const lastEntry = thread.entries.at(-1);
  const lastEntryText = lastEntry
    ? `\nLast turn by ${lastEntry.label}: ${lastEntry.body}`
    : "";

  return `Classic scene:\n${sceneText}${lastEntryText}\nGenerate the next in-character turn.`;
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
  return {
    id: createId("classic-generation-prompt"),
    threadId: thread.id,
    author: {
      kind: "system",
      label: "Classic",
    },
    body: createClassicScenePrompt(thread),
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
