import { createContext, useContext } from 'react'
import type { BubbleThread } from '../../engine/bubbles'
import type { SurfaceId } from '../../engine/surfaces'

export type PondView =
  | { kind: 'pond' }
  | { kind: 'bubble'; threadId: string }

export interface NavState {
  view: PondView
  selectedSurface: SurfaceId
  bubbleThreads: BubbleThread[]
  careOpen: boolean
  careTab: number
}

export interface NavContextType extends NavState {
  setView: (view: PondView) => void
  setSelectedSurface: (surface: SurfaceId) => void
  createBubbleThread: () => BubbleThread
  updateBubbleThread: (thread: BubbleThread) => void
  renameBubbleThread: (threadId: string, title: string) => void
  clearBubbleThreadMessages: (threadId: string) => void
  deleteBubbleThread: (threadId: string) => void
  openBubbleThread: (threadId: string) => void
  setCareOpen: (open: boolean) => void
  setCareTab: (tab: number) => void
}

export const NavContext = createContext<NavContextType>(null!)

export function useNav() {
  return useContext(NavContext)
}
