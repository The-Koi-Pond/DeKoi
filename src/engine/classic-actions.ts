import type { CharacterRecord } from "./character";
import type { ClassicEntry, ClassicThread } from "./classic";
import type { MessengerMessage } from "./messenger";

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createClassicThread({
  activePersonaId,
  characterIds,
  id,
  lorebookIds = [],
  now,
  providerConnectionId = null,
  title,
}: {
  activePersonaId: string | null;
  characterIds: string[];
  id: string;
  lorebookIds?: string[];
  now: string;
  providerConnectionId?: string | null;
  title: string;
}): ClassicThread {
  return {
    id,
    schemaVersion: 1,
    kind: "classic",
    mode: "scene",
    title: cleanText(title, "New Classic Scene"),
    sceneText: "",
    characterIds: cleanIds(characterIds),
    activePersonaId,
    lorebookIds: cleanIds(lorebookIds),
    providerConnectionId,
    entries: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function renameClassicThread(
  thread: ClassicThread,
  title: string,
  updatedAt: string,
): ClassicThread {
  return {
    ...thread,
    title: cleanText(title, thread.title),
    updatedAt,
  };
}

export function updateClassicSceneText(
  thread: ClassicThread,
  sceneText: string,
  updatedAt: string,
): ClassicThread {
  return {
    ...thread,
    sceneText,
    updatedAt,
  };
}

export function appendClassicEntries(
  thread: ClassicThread,
  entries: ClassicEntry[],
  updatedAt: string,
): ClassicThread {
  return {
    ...thread,
    entries: [...thread.entries, ...entries],
    updatedAt,
  };
}

export function clearClassicEntries(
  thread: ClassicThread,
  updatedAt: string,
): ClassicThread {
  return {
    ...thread,
    entries: [],
    updatedAt,
  };
}

export function deleteClassicThread(records: ClassicThread[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function removeClassicThreadCharacter(
  thread: ClassicThread,
  characterId: string,
  updatedAt: string,
): ClassicThread {
  if (!thread.characterIds.includes(characterId)) return thread;

  return {
    ...thread,
    characterIds: thread.characterIds.filter((id) => id !== characterId),
    updatedAt,
  };
}

export function setClassicThreadPersona(
  thread: ClassicThread,
  activePersonaId: string | null,
  updatedAt: string,
): ClassicThread {
  return {
    ...thread,
    activePersonaId: activePersonaId?.trim() || null,
    updatedAt,
  };
}

export function clearClassicThreadPersona(
  thread: ClassicThread,
  personaId: string,
  updatedAt: string,
): ClassicThread {
  if (thread.activePersonaId !== personaId) return thread;
  return setClassicThreadPersona(thread, null, updatedAt);
}

export function removeClassicThreadLorebook(
  thread: ClassicThread,
  lorebookId: string,
  updatedAt: string,
): ClassicThread {
  if (!thread.lorebookIds.includes(lorebookId)) return thread;

  return {
    ...thread,
    lorebookIds: thread.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  };
}

export function replaceClassicThreadProviderConnection(
  thread: ClassicThread,
  deletedConnectionId: string,
  fallbackConnectionId: string,
  updatedAt: string,
): ClassicThread {
  if (thread.providerConnectionId !== deletedConnectionId) return thread;

  return {
    ...thread,
    providerConnectionId: fallbackConnectionId,
    updatedAt,
  };
}

export function createGeneratedClassicEntry({
  companion,
  id,
  message,
  now,
  thread,
}: {
  companion: CharacterRecord;
  id: string;
  message: MessengerMessage;
  now: string;
  thread: ClassicThread;
}): ClassicEntry {
  return {
    id,
    threadId: thread.id,
    role: "character",
    characterId: companion.id,
    personaId: null,
    label: companion.displayName,
    body: message.body,
    origin: "generated",
    createdAt: now,
    updatedAt: now,
  };
}
