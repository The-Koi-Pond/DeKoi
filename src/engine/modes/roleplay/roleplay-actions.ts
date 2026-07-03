import type { CharacterRecord } from "../../contracts/types/character";
import type { RoleplayEntry, RoleplayThread } from "../../contracts/types/roleplay";
import type { PersonaRecord } from "../../contracts/types/persona";

function cleanText(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function cleanIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createRoleplayThread({
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
}): RoleplayThread {
  return {
    id,
    schemaVersion: 1,
    kind: "roleplay",
    mode: "scene",
    title: cleanText(title, "New Roleplay Chat"),
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

export function renameRoleplayThread(
  thread: RoleplayThread,
  title: string,
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    title: cleanText(title, thread.title),
    updatedAt,
  };
}

export function updateRoleplaySceneText(
  thread: RoleplayThread,
  sceneText: string,
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    sceneText,
    updatedAt,
  };
}

export function appendRoleplayEntries(
  thread: RoleplayThread,
  entries: RoleplayEntry[],
): RoleplayThread {
  return {
    ...thread,
    entries: [...thread.entries, ...entries],
  };
}

export function clearRoleplayEntries(thread: RoleplayThread): RoleplayThread {
  return {
    ...thread,
    entries: [],
  };
}

export function updateRoleplayEntryBody(
  thread: RoleplayThread,
  entryId: string,
  body: string,
  updatedAt: string,
): RoleplayThread {
  const cleanBody = cleanText(body);
  if (!cleanBody) return thread;

  return {
    ...thread,
    entries: thread.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            body: cleanBody,
            updatedAt,
          }
        : entry,
    ),
  };
}

export function deleteRoleplayEntry(thread: RoleplayThread, entryId: string): RoleplayThread {
  if (!thread.entries.some((entry) => entry.id === entryId)) return thread;

  return {
    ...thread,
    entries: thread.entries.filter((entry) => entry.id !== entryId),
  };
}

export function createPersonaRoleplayEntry({
  body,
  id,
  now,
  persona,
  thread,
}: {
  body: string;
  id: string;
  now: string;
  persona: PersonaRecord;
  thread: RoleplayThread;
}): RoleplayEntry {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    role: "persona",
    characterId: null,
    personaId: persona.id,
    label: persona.displayName,
    body: cleanText(body),
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function createNarrationRoleplayEntry({
  body,
  id,
  label = "Anonymous",
  now,
  thread,
}: {
  body: string;
  id: string;
  label?: string;
  now: string;
  thread: RoleplayThread;
}): RoleplayEntry {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    role: "narration",
    characterId: null,
    personaId: null,
    label: cleanText(label, "Anonymous"),
    body: cleanText(body),
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function createCompanionRoleplayEntry({
  body,
  companion,
  id,
  now,
  thread,
}: {
  body: string;
  companion: CharacterRecord;
  id: string;
  now: string;
  thread: RoleplayThread;
}): RoleplayEntry {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    role: "character",
    characterId: companion.id,
    personaId: null,
    label: companion.displayName,
    body: cleanText(body),
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteRoleplayThread(records: RoleplayThread[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function removeRoleplayThreadCharacter(
  thread: RoleplayThread,
  characterId: string,
  updatedAt: string,
): RoleplayThread {
  if (!thread.characterIds.includes(characterId)) return thread;

  return {
    ...thread,
    characterIds: thread.characterIds.filter((id) => id !== characterId),
    updatedAt,
  };
}

export function setRoleplayThreadParticipants(
  thread: RoleplayThread,
  characterIds: string[],
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    characterIds: cleanIds(characterIds),
    updatedAt,
  };
}

export function setRoleplayThreadPersona(
  thread: RoleplayThread,
  activePersonaId: string | null,
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    activePersonaId: activePersonaId?.trim() || null,
    updatedAt,
  };
}

export function clearRoleplayThreadPersona(
  thread: RoleplayThread,
  personaId: string,
  updatedAt: string,
): RoleplayThread {
  if (thread.activePersonaId !== personaId) return thread;
  return setRoleplayThreadPersona(thread, null, updatedAt);
}

export function setRoleplayThreadLorebooks(
  thread: RoleplayThread,
  lorebookIds: string[],
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    lorebookIds: cleanIds(lorebookIds),
    updatedAt,
  };
}

export function removeRoleplayThreadLorebook(
  thread: RoleplayThread,
  lorebookId: string,
  updatedAt: string,
): RoleplayThread {
  if (!thread.lorebookIds.includes(lorebookId)) return thread;

  return {
    ...thread,
    lorebookIds: thread.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  };
}

export function setRoleplayThreadProviderConnection(
  thread: RoleplayThread,
  providerConnectionId: string | null,
  updatedAt: string,
): RoleplayThread {
  return {
    ...thread,
    providerConnectionId: providerConnectionId?.trim() || null,
    updatedAt,
  };
}

export function replaceRoleplayThreadProviderConnection(
  thread: RoleplayThread,
  deletedConnectionId: string,
  fallbackConnectionId: string | null,
  updatedAt: string,
): RoleplayThread {
  if (thread.providerConnectionId !== deletedConnectionId) return thread;

  return {
    ...thread,
    providerConnectionId: fallbackConnectionId,
    updatedAt,
  };
}

export function createGeneratedRoleplayEntry({
  body,
  companion,
  id,
  now,
  thread,
}: {
  body: string;
  companion: CharacterRecord;
  id: string;
  now: string;
  thread: RoleplayThread;
}): RoleplayEntry {
  return {
    ...createCompanionRoleplayEntry({
      body,
      companion,
      id,
      now,
      thread,
    }),
    origin: "generated",
  };
}
