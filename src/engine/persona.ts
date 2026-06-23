export const PERSONA_SURFACE_LABEL = 'Personas'

export interface PersonaRecord {
  id: string
  schemaVersion: 1
  displayName: string
  summary: string
  description: string
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}
