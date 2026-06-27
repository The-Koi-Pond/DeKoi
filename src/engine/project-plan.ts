export type DeKoiTrackStatus = 'ready' | 'next' | 'blocked'

export interface DeKoiTrack {
  id: string
  title: string
  status: DeKoiTrackStatus
  summary: string
}

export const projectTracks: DeKoiTrack[] = [
  {
    id: 'identity',
    title: 'Identity',
    status: 'ready',
    summary: 'Name, tone, visual direction, and community posture belong to DeKoi.',
  },
  {
    id: 'provenance',
    title: 'Project provenance',
    status: 'ready',
    summary: 'No source, assets, docs, prompts, schemas, or UI text are copied from the prior fork-derived line.',
  },
  {
    id: 'conversation-core',
    title: 'Conversation core',
    status: 'next',
    summary: 'Design the first local chat loop around DeKoi-owned contracts and storage.',
  },
  {
    id: 'legacy-import',
    title: 'Legacy import',
    status: 'blocked',
    summary: 'Only build import adapters after DeKoi has stable native models.',
  },
]

export function countTracksByStatus(status: DeKoiTrackStatus) {
  return projectTracks.filter((track) => track.status === status).length
}
