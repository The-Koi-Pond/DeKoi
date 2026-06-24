import type { BubbleThread } from '../engine/bubbles'
import { sampleBubbleThread } from '../engine/sample-bubbles'

const BUBBLE_THREADS_STORAGE_KEY = 'dekoi:bubble-threads:v1'
const LEGACY_BUBBLE_THREAD_STORAGE_KEY = 'dekoi:bubble-thread:first-pond'

function isStorageAvailable() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isBubbleThread(value: unknown): value is BubbleThread {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<BubbleThread>
  return (
    candidate.schemaVersion === 1 &&
    candidate.kind === 'bubbles' &&
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    Array.isArray(candidate.messages)
  )
}

function readBubbleThread(key: string) {
  const storedThread = window.localStorage.getItem(key)
  if (!storedThread) return null

  try {
    const parsedThread = JSON.parse(storedThread)
    return isBubbleThread(parsedThread) ? parsedThread : null
  } catch {
    return null
  }
}

function isBubbleThreadList(value: unknown): value is BubbleThread[] {
  return Array.isArray(value) && value.every(isBubbleThread)
}

export function loadBubbleThreads(): BubbleThread[] {
  if (!isStorageAvailable()) return [sampleBubbleThread]

  const storedThreads = window.localStorage.getItem(BUBBLE_THREADS_STORAGE_KEY)
  if (storedThreads) {
    try {
      const parsedThreads = JSON.parse(storedThreads)
      if (isBubbleThreadList(parsedThreads)) return parsedThreads
    } catch {
      // Fall through to the legacy key/sample thread.
    }
  }

  const legacyThread = readBubbleThread(LEGACY_BUBBLE_THREAD_STORAGE_KEY)
  return legacyThread ? [legacyThread] : [sampleBubbleThread]
}

export function saveBubbleThreads(threads: BubbleThread[]) {
  if (!isStorageAvailable()) return

  window.localStorage.setItem(BUBBLE_THREADS_STORAGE_KEY, JSON.stringify(threads))
}

export function loadBubbleThread(threadId?: string) {
  const threads = loadBubbleThreads()
  return threads.find((thread) => thread.id === threadId) ?? threads[0] ?? sampleBubbleThread
}

export function saveBubbleThread(thread: BubbleThread) {
  if (!isStorageAvailable()) return

  const existingThreads = loadBubbleThreads()
  const nextThreads = existingThreads.some((existingThread) => existingThread.id === thread.id)
    ? existingThreads.map((existingThread) => existingThread.id === thread.id ? thread : existingThread)
    : [thread, ...existingThreads]

  saveBubbleThreads(nextThreads)
}

export function resetBubbleThreadStorage(threadId?: string) {
  if (!isStorageAvailable()) return sampleBubbleThread

  if (!threadId) {
    window.localStorage.removeItem(BUBBLE_THREADS_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_BUBBLE_THREAD_STORAGE_KEY)
    return sampleBubbleThread
  }

  const nextThreads = loadBubbleThreads().filter((thread) => thread.id !== threadId)
  saveBubbleThreads(nextThreads)
  return nextThreads[0] ?? sampleBubbleThread
}
