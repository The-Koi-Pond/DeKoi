import type { BubbleThread } from './bubbles'
import type { CharacterRecord } from './character'
import type { LorebookRecord } from './lorebook'
import type { PersonaRecord } from './persona'
import type { RippleState } from './ripples'

const sampleTimestamp = '2026-06-23T09:30:00.000Z'

export const sampleCompanions: CharacterRecord[] = [
  {
    id: 'companion-nami',
    schemaVersion: 1,
    displayName: 'Nami',
    shortName: null,
    summary: 'A patient pondkeeper who notices small changes before anyone else does.',
    description: 'Nami keeps the pond calm, remembers promises, and answers with practical kindness.',
    avatarUrl: null,
    lorebookIds: ['lorebook-first-pond'],
    createdAt: sampleTimestamp,
    updatedAt: sampleTimestamp,
  },
  {
    id: 'companion-ren',
    schemaVersion: 1,
    displayName: 'Ren',
    shortName: null,
    summary: 'A bright, direct companion who turns stalled plans into next moves.',
    description: 'Ren is quick with plain advice and likes turning vague ideas into visible progress.',
    avatarUrl: null,
    lorebookIds: ['lorebook-first-pond'],
    createdAt: sampleTimestamp,
    updatedAt: sampleTimestamp,
  },
]

export const samplePersona: PersonaRecord = {
  id: 'persona-local-self',
  schemaVersion: 1,
  displayName: 'You',
  summary: 'The active local persona for the first Bubble thread.',
  description: 'A private user identity that can be reused across Bubbles and VN threads.',
  avatarUrl: null,
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
}

export const sampleLorebook: LorebookRecord = {
  id: 'lorebook-first-pond',
  schemaVersion: 1,
  title: 'First Pond',
  summary: 'Early DeKoi context for the first clean-room prototype.',
  entries: [
    {
      id: 'lore-entry-private-first',
      title: 'Private first',
      body: 'DeKoi should work locally before it depends on providers or imports.',
      enabled: true,
      createdAt: sampleTimestamp,
      updatedAt: sampleTimestamp,
    },
    {
      id: 'lore-entry-native-records',
      title: 'Native records',
      body: 'Bubbles, Companions, Personas, Lorebooks, and Ripples are DeKoi-owned concepts.',
      enabled: true,
      createdAt: sampleTimestamp,
      updatedAt: sampleTimestamp,
    },
  ],
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
}

export const sampleBubbleThread: BubbleThread = {
  id: 'bubble-thread-first-pond',
  schemaVersion: 1,
  kind: 'bubbles',
  mode: 'group',
  title: 'First Pond Check-In',
  characterIds: sampleCompanions.map((companion) => companion.id),
  activePersonaId: samplePersona.id,
  lorebookIds: [sampleLorebook.id],
  presetId: null,
  providerConnectionId: null,
  messages: [
    {
      id: 'bubble-message-1',
      threadId: 'bubble-thread-first-pond',
      author: {
        kind: 'persona',
        personaId: samplePersona.id,
        label: samplePersona.displayName,
      },
      body: 'I want DeKoi to feel like its own place before we add imports.',
      origin: 'sample',
      createdAt: '2026-06-23T09:31:00.000Z',
      updatedAt: '2026-06-23T09:31:00.000Z',
    },
    {
      id: 'bubble-message-2',
      threadId: 'bubble-thread-first-pond',
      author: {
        kind: 'character',
        characterId: 'companion-nami',
        label: 'Nami',
      },
      body: 'Then start with the pond itself. Names first, records second, imports last.',
      origin: 'sample',
      createdAt: '2026-06-23T09:32:00.000Z',
      updatedAt: '2026-06-23T09:32:00.000Z',
    },
    {
      id: 'bubble-message-3',
      threadId: 'bubble-thread-first-pond',
      author: {
        kind: 'character',
        characterId: 'companion-ren',
        label: 'Ren',
      },
      body: 'The first working slice can be tiny. One Bubble thread, two Companions, saved locally.',
      origin: 'sample',
      createdAt: '2026-06-23T09:33:00.000Z',
      updatedAt: '2026-06-23T09:33:00.000Z',
    },
  ],
  createdAt: sampleTimestamp,
  updatedAt: '2026-06-23T09:33:00.000Z',
}

export const sampleRippleState: RippleState = {
  id: 'ripple-state-first-pond',
  schemaVersion: 1,
  threadId: sampleBubbleThread.id,
  ripples: [
    {
      id: 'ripple-clean-room',
      tone: 'note',
      title: 'Clean-room boundary',
      body: 'Native records come before compatibility adapters.',
      updatedAt: sampleTimestamp,
    },
    {
      id: 'ripple-first-slice',
      tone: 'shift',
      title: 'First slice',
      body: 'Bubbles are the first implementation target.',
      updatedAt: sampleTimestamp,
    },
  ],
  createdAt: sampleTimestamp,
  updatedAt: sampleTimestamp,
}
