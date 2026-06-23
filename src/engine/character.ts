export const COMPANION_SURFACE_LABEL = 'Companions'

export interface CharacterRecord {
  id: string
  schemaVersion: 1
  displayName: string
  shortName: string | null
  summary: string
  description: string
  avatarUrl: string | null
  lorebookIds: string[]
  createdAt: string
  updatedAt: string
}
