export const BUBBLES_SURFACE_LABEL = 'Bubbles'
export const POND_SURFACE_LABEL = 'Pond'

export type BubbleThreadKind = 'bubbles'
export type BubbleThreadMode = 'direct' | 'group'
export type BubbleMessageOrigin = 'manual' | 'generated' | 'imported' | 'sample'

export type BubbleMessageAuthor =
  | {
      kind: 'persona'
      personaId: string
      label: string
    }
  | {
      kind: 'character'
      characterId: string
      label: string
    }
  | {
      kind: 'system'
      label: string
    }
  | {
      kind: 'unknown'
      label: string
    }

export interface BubbleMessage {
  id: string
  threadId: string
  author: BubbleMessageAuthor
  body: string
  origin: BubbleMessageOrigin
  createdAt: string
  updatedAt: string
}

export interface BubbleThread {
  id: string
  schemaVersion: 1
  kind: BubbleThreadKind
  mode: BubbleThreadMode
  title: string
  characterIds: string[]
  activePersonaId: string | null
  lorebookIds: string[]
  presetId: string | null
  providerConnectionId: string | null
  messages: BubbleMessage[]
  createdAt: string
  updatedAt: string
}
