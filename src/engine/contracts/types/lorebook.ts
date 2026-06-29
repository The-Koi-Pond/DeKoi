export const LOREBOOK_SURFACE_LABEL = 'Lorebooks'

export interface LorebookEntryRecord {
  id: string
  title: string
  body: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface LorebookRecord {
  id: string
  schemaVersion: 1
  title: string
  summary: string
  entries: LorebookEntryRecord[]
  createdAt: string
  updatedAt: string
}
