export const MESSENGER_SURFACE_LABEL = 'Messenger'
export const POND_SURFACE_LABEL = 'Pond'

export type MessengerThreadKind = 'messenger'
export type MessengerThreadMode = 'direct' | 'group'
export type MessengerMessageOrigin = 'manual' | 'generated' | 'imported' | 'placeholder' | 'sample'

export type MessengerMessageAuthor =
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

export interface MessengerMessage {
  id: string
  threadId: string
  author: MessengerMessageAuthor
  body: string
  origin: MessengerMessageOrigin
  createdAt: string
  updatedAt: string
}

export interface MessengerThread {
  id: string
  schemaVersion: 1
  kind: MessengerThreadKind
  mode: MessengerThreadMode
  title: string
  characterIds: string[]
  activePersonaId: string | null
  lorebookIds: string[]
  presetId: string | null
  providerConnectionId: string | null
  messages: MessengerMessage[]
  createdAt: string
  updatedAt: string
}
