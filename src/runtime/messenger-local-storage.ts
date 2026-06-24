import type { MessengerMessage, MessengerThread } from '../engine/messenger'
import { sampleMessengerThread } from '../engine/sample-messenger'

const MESSENGER_THREADS_STORAGE_KEY = 'dekoi:messenger-threads:v1'
const LEGACY_BUBBLE_THREADS_STORAGE_KEY = 'dekoi:bubble-threads:v1'
const LEGACY_BUBBLE_THREAD_STORAGE_KEY = 'dekoi:bubble-thread:first-pond'

function isStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function migrateLegacyId(id: string) {
  return id
    .replace(/^bubble-thread/, 'messenger-thread')
    .replace(/^bubble-message/, 'messenger-message')
}

function migrateLegacyTitle(title: string) {
  return title.replace(/^New Bubble\b/, 'New Messenger')
}

function normalizeMessengerMessage(value: unknown, threadId: string): MessengerMessage | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<MessengerMessage>
  if (
    typeof candidate.id !== 'string' ||
    !candidate.author ||
    typeof candidate.body !== 'string' ||
    typeof candidate.origin !== 'string' ||
    typeof candidate.createdAt !== 'string' ||
    typeof candidate.updatedAt !== 'string'
  ) {
    return null
  }

  return {
    ...candidate,
    id: migrateLegacyId(candidate.id),
    threadId,
  } as MessengerMessage
}

function normalizeMessengerThread(value: unknown): MessengerThread | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<MessengerThread> & { kind?: unknown }
  if (
    candidate.schemaVersion === 1 &&
    (candidate.kind === 'messenger' || candidate.kind === 'bubbles') &&
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.messages)
  ) {
    const id = migrateLegacyId(candidate.id)
    const messages = candidate.messages
      .map((message) => normalizeMessengerMessage(message, id))
      .filter((message): message is MessengerMessage => message !== null)

    return {
      ...candidate,
      id,
      kind: 'messenger',
      title: migrateLegacyTitle(candidate.title),
      providerConnectionId:
        typeof candidate.providerConnectionId === 'string'
          ? candidate.providerConnectionId
          : null,
      messages,
    } as MessengerThread
  }

  return null
}

function readMessengerThread(key: string) {
  const storedThread = window.localStorage.getItem(key)
  if (!storedThread) return null

  try {
    const parsedThread = JSON.parse(storedThread)
    return normalizeMessengerThread(parsedThread)
  } catch {
    return null
  }
}

function normalizeMessengerThreadList(value: unknown): MessengerThread[] | null {
  if (!Array.isArray(value)) return null

  const threads = value
    .map(normalizeMessengerThread)
    .filter((thread): thread is MessengerThread => thread !== null)

  return threads.length === value.length ? threads : null
}

function readMessengerThreadList(key: string) {
  const storedThreads = window.localStorage.getItem(key)
  if (!storedThreads) return null

  try {
    const parsedThreads = JSON.parse(storedThreads)
    return normalizeMessengerThreadList(parsedThreads)
  } catch {
    return null
  }
}

export function loadMessengerThreads(): MessengerThread[] {
  if (!isStorageAvailable()) return [sampleMessengerThread]

  const storedThreads = readMessengerThreadList(MESSENGER_THREADS_STORAGE_KEY)
  if (storedThreads) return storedThreads

  const legacyThreads = readMessengerThreadList(LEGACY_BUBBLE_THREADS_STORAGE_KEY)
  if (legacyThreads) return legacyThreads

  const legacyThread = readMessengerThread(LEGACY_BUBBLE_THREAD_STORAGE_KEY)
  return legacyThread ? [legacyThread] : [sampleMessengerThread]
}

export function saveMessengerThreads(threads: MessengerThread[]) {
  if (!isStorageAvailable()) return

  window.localStorage.setItem(MESSENGER_THREADS_STORAGE_KEY, JSON.stringify(threads))
}

export function loadMessengerThread(threadId?: string) {
  const threads = loadMessengerThreads()
  return threads.find((thread) => thread.id === threadId) ?? threads[0] ?? sampleMessengerThread
}

export function saveMessengerThread(thread: MessengerThread) {
  if (!isStorageAvailable()) return

  const existingThreads = loadMessengerThreads()
  const nextThreads = existingThreads.some((existingThread) => existingThread.id === thread.id)
    ? existingThreads.map((existingThread) => existingThread.id === thread.id ? thread : existingThread)
    : [thread, ...existingThreads]

  saveMessengerThreads(nextThreads)
}

export function resetMessengerThreadStorage(threadId?: string) {
  if (!isStorageAvailable()) return sampleMessengerThread

  if (!threadId) {
    window.localStorage.removeItem(MESSENGER_THREADS_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_BUBBLE_THREADS_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_BUBBLE_THREAD_STORAGE_KEY)
    return sampleMessengerThread
  }

  const nextThreads = loadMessengerThreads().filter((thread) => thread.id !== threadId)
  saveMessengerThreads(nextThreads)
  return nextThreads[0] ?? sampleMessengerThread
}
