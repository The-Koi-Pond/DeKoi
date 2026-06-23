import type { BubbleThread } from '../engine/bubbles'
import { sampleBubbleThread } from '../engine/sample-bubbles'

const BUBBLE_THREAD_STORAGE_KEY = 'dekoi:bubble-thread:first-pond'

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

export function loadBubbleThread() {
  if (!isStorageAvailable()) return sampleBubbleThread

  const storedThread = window.localStorage.getItem(BUBBLE_THREAD_STORAGE_KEY)
  if (!storedThread) return sampleBubbleThread

  try {
    const parsedThread = JSON.parse(storedThread)
    return isBubbleThread(parsedThread) ? parsedThread : sampleBubbleThread
  } catch {
    return sampleBubbleThread
  }
}

export function saveBubbleThread(thread: BubbleThread) {
  if (!isStorageAvailable()) return

  window.localStorage.setItem(BUBBLE_THREAD_STORAGE_KEY, JSON.stringify(thread))
}

export function resetBubbleThreadStorage() {
  if (!isStorageAvailable()) return sampleBubbleThread

  window.localStorage.removeItem(BUBBLE_THREAD_STORAGE_KEY)
  return sampleBubbleThread
}
