import { createLorebookEntryRecord, createLorebookRecord } from "../catalog/lorebook-actions";
import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookActivationSettings, LorebookRecord } from "../contracts/types/lorebook";
import type {
  MessengerModeThread,
  ModeMessage,
  RoleplayModeThread,
} from "../contracts/types/mode-thread";
import { createModeMessage } from "../modes/mode-thread/mode-thread-actions";
import { createMessengerThread } from "../modes/messenger/messenger-actions";
import { createRoleplayThread } from "../modes/roleplay/roleplay-actions";

export const LOREBOOK_GENERATION_TEST_NOW = "2026-07-02T00:00:00.000Z";

export function lorebookGenerationCharacter(input: Partial<CharacterRecord> = {}): CharacterRecord {
  return {
    id: "character-1",
    schemaVersion: 1,
    displayName: "Mara",
    nickname: null,
    description: "",
    personality: "",
    scenario: "",
    firstMessage: "",
    alternateGreetings: [],
    groupOnlyGreetings: [],
    exampleMessages: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    creator: "",
    characterVersion: "",
    creatorNotes: "",
    tags: [],
    characterNote: "",
    characterNoteDepth: 0,
    characterNoteRole: "system",
    talkativeness: 0.5,
    avatarUrl: null,
    createdAt: LOREBOOK_GENERATION_TEST_NOW,
    updatedAt: LOREBOOK_GENERATION_TEST_NOW,
    ...input,
    lorebookIds: input.lorebookIds ?? [],
  };
}

export function selectiveLorebookFixture({
  entries,
  id,
  summary = "",
  title,
  activation,
}: {
  id: string;
  title: string;
  summary?: string;
  activation?: Partial<LorebookActivationSettings>;
  entries: {
    body: string;
    id: string;
    input?: Partial<Parameters<typeof createLorebookEntryRecord>[0]["input"]>;
    key?: string[];
    title: string;
  }[];
}): LorebookRecord {
  const record = createLorebookRecord({
    id,
    input: { title, summary, activation },
    now: LOREBOOK_GENERATION_TEST_NOW,
  });

  return {
    ...record,
    entries: entries.map((entry) =>
      createLorebookEntryRecord({
        id: entry.id,
        input: {
          title: entry.title,
          body: entry.body,
          strategy: "selective",
          key: entry.key ?? [],
          ...entry.input,
        },
        now: LOREBOOK_GENERATION_TEST_NOW,
      }),
    ),
  };
}

export function messengerThreadFixture(
  input: Omit<Parameters<typeof createMessengerThread>[0], "branchId" | "now"> & {
    messages?: ModeMessage[];
    presetId?: string | null;
  },
): MessengerModeThread {
  const { messages = [], presetId, ...creationInput } = input;
  const thread = createMessengerThread({
    ...creationInput,
    branchId: `${creationInput.id}-branch`,
    defaultPromptPresetId: presetId,
    now: LOREBOOK_GENERATION_TEST_NOW,
  });
  return { ...thread, messages };
}

export function messengerMessageFixture(id: string, body: string): ModeMessage {
  return createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: "messenger-thread-1",
    branchId: "messenger-thread-1-branch",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body,
    origin: "manual",
    now: LOREBOOK_GENERATION_TEST_NOW,
  });
}

export function roleplayThreadFixture(
  input: Omit<
    Parameters<typeof createRoleplayThread>[0],
    "branchId" | "now" | "openingCharacter"
  > & {
    openingCharacter?: Parameters<typeof createRoleplayThread>[0]["openingCharacter"];
    messages?: ModeMessage[];
    presetId?: string | null;
  },
): RoleplayModeThread {
  const { messages = [], openingCharacter = null, presetId, ...creationInput } = input;
  const thread = createRoleplayThread({
    ...creationInput,
    branchId: `${creationInput.id}-branch`,
    defaultPromptPresetId: presetId,
    openingCharacter,
    now: LOREBOOK_GENERATION_TEST_NOW,
  });
  return { ...thread, messages };
}

export function roleplayMessageFixture(id: string, body: string): ModeMessage {
  return createModeMessage({
    id,
    versionId: `${id}-v1`,
    threadId: "roleplay-thread-1",
    branchId: "roleplay-thread-1-branch",
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    body,
    origin: "manual",
    now: LOREBOOK_GENERATION_TEST_NOW,
  });
}
