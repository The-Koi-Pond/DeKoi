import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerMessage,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from "../../contracts/types/messenger";
import type { CharacterRecord } from "../../contracts/types/character";
import type { PersonaRecord } from "../../contracts/types/persona";
import type {
  PromptPresetChoiceSelection,
  PromptPresetChoiceSelections,
} from "../../contracts/types/prompt-presets";
import { updatePromptPresetChoiceSelections } from "../../prompt-presets/prompt-preset-normalization";
import { cleanTextArray } from "../../shared/text";

export function createMessengerThread({
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
}): MessengerThread {
  return {
    id,
    schemaVersion: 1,
    kind: "messenger",
    mode: characterIds.length > 1 ? "group" : "direct",
    title,
    characterIds,
    activePersonaId,
    lorebookIds,
    presetId: null,
    presetChoiceSelections: {},
    providerConnectionId,
    systemPromptMode: "default",
    systemPrompt: DEFAULT_MESSENGER_SYSTEM_PROMPT,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function appendMessengerMessages(
  thread: MessengerThread,
  messages: MessengerMessage[],
): MessengerThread {
  return {
    ...thread,
    messages: [...thread.messages, ...messages],
  };
}

export function clearMessengerMessages(thread: MessengerThread): MessengerThread {
  return {
    ...thread,
    messages: [],
  };
}

export function updateMessengerMessageBody(
  thread: MessengerThread,
  messageId: string,
  body: string,
  updatedAt: string,
): MessengerThread {
  const cleanBody = body.trim();
  if (!cleanBody) return thread;

  return {
    ...thread,
    messages: thread.messages.map((message) =>
      message.id === messageId
        ? {
            ...message,
            body: cleanBody,
            updatedAt,
          }
        : message,
    ),
  };
}

export function deleteMessengerMessage(
  thread: MessengerThread,
  messageId: string,
): MessengerThread {
  if (!thread.messages.some((message) => message.id === messageId)) return thread;

  return {
    ...thread,
    messages: thread.messages.filter((message) => message.id !== messageId),
  };
}

export function renameMessengerThread(
  thread: MessengerThread,
  title: string,
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    title,
    updatedAt,
  };
}

export function deleteMessengerThread(records: MessengerThread[], id: string) {
  return records.filter((record) => record.id !== id);
}

export function setMessengerThreadParticipants(
  thread: MessengerThread,
  characterIds: string[],
  updatedAt: string,
): MessengerThread {
  const cleanCharacterIds = cleanTextArray(characterIds);
  return {
    ...thread,
    characterIds: cleanCharacterIds,
    mode: cleanCharacterIds.length > 1 ? "group" : "direct",
    updatedAt,
  };
}

export function setMessengerThreadPersona(
  thread: MessengerThread,
  activePersonaId: string | null,
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    activePersonaId: activePersonaId?.trim() || null,
    updatedAt,
  };
}

export function setMessengerThreadLorebooks(
  thread: MessengerThread,
  lorebookIds: string[],
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    lorebookIds: cleanTextArray(lorebookIds),
    updatedAt,
  };
}

export function setMessengerThreadProviderConnection(
  thread: MessengerThread,
  providerConnectionId: string | null,
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    providerConnectionId,
    updatedAt,
  };
}

export function setMessengerThreadPreset(
  thread: MessengerThread,
  presetId: string | null,
  updatedAt: string,
  presetChoiceSelections?: PromptPresetChoiceSelections,
): MessengerThread {
  const cleanPresetId = presetId?.trim() || null;
  if (cleanPresetId === thread.presetId && presetChoiceSelections === undefined) return thread;

  return {
    ...thread,
    presetId: cleanPresetId,
    presetChoiceSelections: presetChoiceSelections ?? {},
    updatedAt,
  };
}

export function setMessengerThreadPresetChoiceSelection(
  thread: MessengerThread,
  variableName: string,
  selection: PromptPresetChoiceSelection,
  updatedAt: string,
): MessengerThread {
  const cleanVariableName = variableName.trim();
  if (!cleanVariableName) return thread;

  return {
    ...thread,
    presetChoiceSelections: updatePromptPresetChoiceSelections(
      thread.presetChoiceSelections ?? {},
      cleanVariableName,
      selection,
    ),
    updatedAt,
  };
}

export function removeMessengerThreadPreset(
  thread: MessengerThread,
  presetId: string,
  updatedAt: string,
): MessengerThread {
  if (thread.presetId !== presetId) return thread;
  return setMessengerThreadPreset(thread, null, updatedAt);
}

export function setMessengerThreadSystemPrompt(
  thread: MessengerThread,
  systemPromptMode: MessengerSystemPromptMode,
  systemPrompt: string,
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    systemPromptMode,
    systemPrompt,
    updatedAt,
  };
}

export function removeMessengerThreadCharacter(
  thread: MessengerThread,
  characterId: string,
  updatedAt: string,
): MessengerThread {
  if (!thread.characterIds.includes(characterId)) return thread;
  return setMessengerThreadParticipants(
    thread,
    thread.characterIds.filter((id) => id !== characterId),
    updatedAt,
  );
}

export function clearMessengerThreadPersona(
  thread: MessengerThread,
  personaId: string,
  updatedAt: string,
): MessengerThread {
  if (thread.activePersonaId !== personaId) return thread;
  return setMessengerThreadPersona(thread, null, updatedAt);
}

export function removeMessengerThreadLorebook(
  thread: MessengerThread,
  lorebookId: string,
  updatedAt: string,
): MessengerThread {
  if (!thread.lorebookIds.includes(lorebookId)) return thread;
  return setMessengerThreadLorebooks(
    thread,
    thread.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  );
}

export function replaceMessengerThreadProviderConnection(
  thread: MessengerThread,
  deletedConnectionId: string,
  fallbackConnectionId: string | null,
  updatedAt: string,
): MessengerThread {
  if (thread.providerConnectionId !== deletedConnectionId) return thread;
  return setMessengerThreadProviderConnection(thread, fallbackConnectionId, updatedAt);
}

export function createPersonaMessengerMessage({
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
  thread: MessengerThread;
}): MessengerMessage {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    author: {
      kind: "persona",
      personaId: persona.id,
      label: persona.displayName,
    },
    body,
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function createAnonymousMessengerMessage({
  body,
  id,
  now,
  thread,
}: {
  body: string;
  id: string;
  now: string;
  thread: MessengerThread;
}): MessengerMessage {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    author: {
      kind: "unknown",
      label: "Anonymous",
    },
    body,
    origin: "manual",
    createdAt: now,
    updatedAt: now,
  };
}

export function createGeneratedCompanionMessage({
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
  thread: MessengerThread;
}): MessengerMessage {
  return {
    id,
    schemaVersion: 1,
    threadId: thread.id,
    author: {
      kind: "character",
      characterId: companion.id,
      label: companion.displayName,
    },
    body,
    origin: "generated",
    createdAt: now,
    updatedAt: now,
  };
}

export function getNextMessengerCompanion(thread: MessengerThread, companions: CharacterRecord[]) {
  const availableCompanions = companions.filter((companion) =>
    thread.characterIds.includes(companion.id),
  );
  if (availableCompanions.length === 0) return null;

  const companionMessageCount = thread.messages.filter(
    (message) => message.author.kind === "character",
  ).length;
  return availableCompanions[companionMessageCount % availableCompanions.length];
}
