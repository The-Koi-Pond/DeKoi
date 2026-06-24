import { createContext, useContext } from 'react'
import type { MessengerThread } from '../../engine/messenger'
import type { SurfaceId } from '../../engine/surfaces'
import type { AppSettings, ShoalSortMode } from '../../runtime/app-settings'
import type { MessengerStorageMode, MessengerStorageStatus } from '../../runtime/messenger-storage'

export type PondView =
  | { kind: 'pond' }
  | { kind: 'messenger'; threadId: string }

export interface NavState {
  view: PondView
  selectedSurface: SurfaceId
  messengerThreads: MessengerThread[]
  messengerStorageMode: MessengerStorageMode
  messengerStorageStatus: MessengerStorageStatus
  messengerStorageMessage: string
  remoteRuntimeUrl: string
  appSettings: AppSettings
  careOpen: boolean
  careTab: number
}

export interface NavContextType extends NavState {
  setView: (view: PondView) => void
  setSelectedSurface: (surface: SurfaceId) => void
  createMessengerThread: () => MessengerThread
  updateMessengerThread: (thread: MessengerThread) => void
  renameMessengerThread: (threadId: string, title: string) => void
  clearMessengerThreadMessages: (threadId: string) => void
  deleteMessengerThread: (threadId: string) => void
  openMessengerThread: (threadId: string) => void
  setRemoteRuntimeUrl: (url: string) => void
  setSendOnEnterSurface: (surface: SurfaceId) => void
  setConfirmRelease: (confirmRelease: boolean) => void
  setSurfaceStatus: (status: string) => void
  setShoalSortMode: (sortMode: ShoalSortMode) => void
  setCareOpen: (open: boolean) => void
  setCareTab: (tab: number) => void
}

export const NavContext = createContext<NavContextType>(null!)

export function useNav() {
  return useContext(NavContext)
}
