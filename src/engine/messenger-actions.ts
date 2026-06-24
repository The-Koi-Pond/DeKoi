import type { MessengerMessage, MessengerThread } from './messenger'
import type { CharacterRecord } from './character'
import type { PersonaRecord } from './persona'

export function createMessengerThread({
  activePersonaId,
  characterIds,
  id,
  lorebookIds = [],
  now,
  title,
}: {
  activePersonaId: string | null
  characterIds: string[]
  id: string
  lorebookIds?: string[]
  now: string
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
    providerConnectionId: null,
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

export function renameMessengerThread(thread: MessengerThread, title: string, updatedAt: string): MessengerThread {
  return {
    ...thread,
    title,
    updatedAt,
  }
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

export function getNextPlaceholderCompanion(thread: MessengerThread, companions: CharacterRecord[]) {
  const availableCompanions = companions.filter((companion) => thread.characterIds.includes(companion.id))
  if (availableCompanions.length === 0) return null

  const companionMessageCount = thread.messages.filter((message) => message.author.kind === 'character').length
  return availableCompanions[companionMessageCount % availableCompanions.length]
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
