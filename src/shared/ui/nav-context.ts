import { createContext, useContext } from 'react'
import type { SurfaceId } from '../../engine/surfaces'

export type PondView =
  | { kind: 'pond' }
  | { kind: 'bubble'; threadId: string }

export interface NavState {
  view: PondView
  selectedSurface: SurfaceId
  careOpen: boolean
  careTab: number
}

export interface NavContextType extends NavState {
  setView: (view: PondView) => void
  setSelectedSurface: (surface: SurfaceId) => void
  setCareOpen: (open: boolean) => void
  setCareTab: (tab: number) => void
}

export const NavContext = createContext<NavContextType>(null!)

export function useNav() {
  return useContext(NavContext)
}
