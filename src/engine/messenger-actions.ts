import {
  DEFAULT_MESSENGER_SYSTEM_PROMPT,
  type MessengerMessage,
  type MessengerSystemPromptMode,
  type MessengerThread,
} from './messenger'
import type { CharacterRecord } from './character'
import type { PersonaRecord } from './persona'

export function createMessengerThread({
  activePersonaId,
  characterIds,
  id,
  lorebookIds = [],
  now,
  providerConnectionId = null,
  title,
}: {
  activePersonaId: string | null
  characterIds: string[]
  id: string
  lorebookIds?: string[]
  now: string
  providerConnectionId?: string | null
  title: string
}): MessengerThread {
  return {
    id,
    schemaVersion: 1,
    kind: 'messenger',
    mode: characterIds.length > 1 ? 'group' : 'direct',
    title,
    characterIds,
    activePersonaId,
    lorebookIds,
    presetId: null,
    providerConnectionId,
    systemPromptMode: 'default',
    systemPrompt: DEFAULT_MESSENGER_SYSTEM_PROMPT,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function appendMessengerMessages(
  thread: MessengerThread,
  messages: MessengerMessage[],
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    messages: [...thread.messages, ...messages],
    updatedAt,
  }
}

export function clearMessengerMessages(thread: MessengerThread, updatedAt: string): MessengerThread {
  return {
    ...thread,
    messages: [],
    updatedAt,
  }
}

export function updateMessengerMessageBody(
  thread: MessengerThread,
  messageId: string,
  body: string,
  updatedAt: string,
): MessengerThread {
  const cleanBody = body.trim()
  if (!cleanBody) return thread

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
    updatedAt,
  }
}

export function deleteMessengerMessage(
  thread: MessengerThread,
  messageId: string,
  updatedAt: string,
): MessengerThread {
  if (!thread.messages.some((message) => message.id === messageId)) return thread

  return {
    ...thread,
    messages: thread.messages.filter((message) => message.id !== messageId),
    updatedAt,
  }
}

export function renameMessengerThread(thread: MessengerThread, title: string, updatedAt: string): MessengerThread {
  return {
    ...thread,
    title,
    updatedAt,
  }
}

export function deleteMessengerThread(records: MessengerThread[], id: string) {
  return records.filter((record) => record.id !== id)
}

function cleanThreadIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
}

export function setMessengerThreadParticipants(
  thread: MessengerThread,
  characterIds: string[],
  updatedAt: string,
): MessengerThread {
  const cleanCharacterIds = cleanThreadIds(characterIds)
  return {
    ...thread,
    characterIds: cleanCharacterIds,
    mode: cleanCharacterIds.length > 1 ? 'group' : 'direct',
    updatedAt,
  }
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
  }
}

export function setMessengerThreadLorebooks(
  thread: MessengerThread,
  lorebookIds: string[],
  updatedAt: string,
): MessengerThread {
  return {
    ...thread,
    lorebookIds: cleanThreadIds(lorebookIds),
    updatedAt,
  }
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
  }
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
  }
}

export function removeMessengerThreadCharacter(
  thread: MessengerThread,
  characterId: string,
  updatedAt: string,
): MessengerThread {
  if (!thread.characterIds.includes(characterId)) return thread
  return setMessengerThreadParticipants(
    thread,
    thread.characterIds.filter((id) => id !== characterId),
    updatedAt,
  )
}

export function clearMessengerThreadPersona(
  thread: MessengerThread,
  personaId: string,
  updatedAt: string,
): MessengerThread {
  if (thread.activePersonaId !== personaId) return thread
  return setMessengerThreadPersona(thread, null, updatedAt)
}

export function removeMessengerThreadLorebook(
  thread: MessengerThread,
  lorebookId: string,
  updatedAt: string,
): MessengerThread {
  if (!thread.lorebookIds.includes(lorebookId)) return thread
  return setMessengerThreadLorebooks(
    thread,
    thread.lorebookIds.filter((id) => id !== lorebookId),
    updatedAt,
  )
}

export function replaceMessengerThreadProviderConnection(
  thread: MessengerThread,
  deletedConnectionId: string,
  fallbackConnectionId: string,
  updatedAt: string,
): MessengerThread {
  if (thread.providerConnectionId !== deletedConnectionId) return thread
  return setMessengerThreadProviderConnection(thread, fallbackConnectionId, updatedAt)
}

export function createPersonaMessengerMessage({
  body,
  id,
  now,
  persona,
  thread,
}: {
  body: string
  id: string
  now: string
  persona: PersonaRecord
  thread: MessengerThread
}): MessengerMessage {
  return {
    id,
    threadId: thread.id,
    author: {
      kind: 'persona',
      personaId: persona.id,
      label: persona.displayName,
    },
    body,
    origin: 'manual',
    createdAt: now,
    updatedAt: now,
  }
}

export function createAnonymousMessengerMessage({
  body,
  id,
  now,
  thread,
}: {
  body: string
  id: string
  now: string
  thread: MessengerThread
}): MessengerMessage {
  return {
    id,
    threadId: thread.id,
    author: {
      kind: 'unknown',
      label: 'Anonymous',
    },
    body,
    origin: 'manual',
    createdAt: now,
    updatedAt: now,
  }
}

export function createPlaceholderCompanionMessage({
  body,
  companion,
  id,
  now,
  thread,
}: {
  body: string
  companion: CharacterRecord
  id: string
  now: string
  thread: MessengerThread
}): MessengerMessage {
  return {
    id,
    threadId: thread.id,
    author: {
      kind: 'character',
      characterId: companion.id,
      label: companion.displayName,
    },
    body,
    origin: 'placeholder',
    createdAt: now,
    updatedAt: now,
  }
}

export function createGeneratedCompanionMessage({
  body,
  companion,
  id,
  now,
  thread,
}: {
  body: string
  companion: CharacterRecord
  id: string
  now: string
  thread: MessengerThread
}): MessengerMessage {
  return {
    id,
    threadId: thread.id,
    author: {
      kind: 'character',
      characterId: companion.id,
      label: companion.displayName,
    },
    body,
    origin: 'generated',
    createdAt: now,
    updatedAt: now,
  }
}

export function getNextMessengerCompanion(thread: MessengerThread, companions: CharacterRecord[]) {
  const availableCompanions = companions.filter((companion) => thread.characterIds.includes(companion.id))
  if (availableCompanions.length === 0) return null

  const companionMessageCount = thread.messages.filter((message) => message.author.kind === 'character').length
  return availableCompanions[companionMessageCount % availableCompanions.length]
}

export function getNextPlaceholderCompanion(thread: MessengerThread, companions: CharacterRecord[]) {
  return getNextMessengerCompanion(thread, companions)
}

export function getPlaceholderReplyText(messageBody: string) {
  const trimmedBody = messageBody.trim()
  if (trimmedBody.endsWith('?')) {
    return 'I can answer for the local prototype: this Messenger thread is saved in your browser for now.'
  }

  if (trimmedBody.length > 120) {
    return 'Got it. I kept the important part in this local Messenger thread so we can reload and keep going.'
  }

  return 'Noted. This is a placeholder reply until provider support exists.'
}
