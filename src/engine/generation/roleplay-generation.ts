import type { CharacterRecord } from "../contracts/types/character";
import type { LorebookRecord } from "../contracts/types/lorebook";
import type { PersonaRecord } from "../contracts/types/persona";
import type { ProviderConnectionRecord } from "../contracts/types/provider-connection";
import type {
  RoleplayEntry,
  RoleplayThread,
} from "../contracts/types/roleplay";
import type { LorebookScanSource } from "../generation-core/lorebook-activation";
import {
  characterGenerationContext,
  cleanGenerationText,
  createGenerationParameters,
  exampleDialogueGenerationContext,
  loreGenerationContext,
  namedGenerationBlock,
  personaGenerationContext,
  replaceGenerationPromptMacros,
  resolveGenerationRecords,
} from "./generation";
import type {
  GenerationAdapter,
  GeneratedMessageDraft,
  GenerationParameters,
  GenerationPromptMessage,
  GenerationProviderKind,
  GenerationResponse,
} from "./generation";

export const DEFAULT_ROLEPLAY_SYSTEM_PROMPT = `<role>
You are {{charName}}, writing the next in-character turn in an ongoing fictional roleplay with {{userName}}.
Treat the conversation as a continuous scene, not a chat with an assistant.
</role>

<rules>
Here are the rules for the interaction:
- Stay in character based on your description, personality, scenario, memories, lore, and relationship with {{userName}}.
- Continue naturally from the latest message. Do not recap the scene unless {{charName}} would naturally do that.
- Write only {{charName}}'s next reply or action. Do not write {{userName}}'s response.
- Preserve the established writing style, tense, formatting, and message length from the existing thread.
- Dialogue, narration, and actions are allowed when they fit the scene.
- Do not describe yourself as an AI, assistant, narrator, model, or writing partner.
- Do not include timestamps, dates, brackets, speaker labels, markdown fences, or metadata in your reply.
- Your output must contain only {{charName}}'s natural next turn.
</rules>`;

export type RoleplayGenerationProviderKind = GenerationProviderKind;
export type RoleplayGenerationPromptMessage = GenerationPromptMessage;
export type RoleplayGenerationParameters = GenerationParameters;
export type RoleplayGeneratedMessageDraft = GeneratedMessageDraft;
export type RoleplayGenerationResponse = GenerationResponse;

export interface RoleplayGenerationRequest {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  thread: RoleplayThread;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: RoleplayGenerationPromptMessage[];
  parameters: RoleplayGenerationParameters;
}

export type RoleplayGenerationAdapter = GenerationAdapter<RoleplayGenerationRequest>;

export interface RoleplayGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  requestThread: RoleplayThread;
  warnings: string[];
}

export interface RoleplayGenerationContextInput {
  thread: RoleplayThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
}

function roleplayEntryRole(entry: RoleplayEntry): RoleplayGenerationPromptMessage["role"] {
  return entry.role === "character" ? "assistant" : "user";
}

function roleplayEntryContent(entry: RoleplayEntry) {
  const label = cleanGenerationText(entry.label) || "Unknown";
  if (entry.role === "scene") return `Scene: ${entry.body.trim()}`;
  if (entry.role === "narration") return `Narration: ${entry.body.trim()}`;
  return `${label}: ${entry.body.trim()}`;
}

function roleplayLoreScanSources(thread: RoleplayThread): LorebookScanSource[] {
  return thread.entries.map((entry) => ({
    name: cleanGenerationText(entry.label) || null,
    body: entry.body,
  }));
}

export function getNextRoleplayCompanion(
  thread: RoleplayThread,
  companions: CharacterRecord[],
) {
  const availableCompanions = companions.filter((companion) =>
    thread.characterIds.includes(companion.id),
  );
  if (availableCompanions.length === 0) return null;

  const companionEntryCount = thread.entries.filter(
    (entry) =>
      entry.role === "character" &&
      !!entry.characterId &&
      thread.characterIds.includes(entry.characterId),
  ).length;
  return availableCompanions[companionEntryCount % availableCompanions.length];
}

export function createRoleplayGenerationContext({
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: RoleplayGenerationContextInput): RoleplayGenerationContext {
  const records = resolveGenerationRecords({
    activePersonaId: thread.activePersonaId,
    characterIds: thread.characterIds,
    characters,
    fallbackProviderConnectionId,
    lorebookIds: thread.lorebookIds,
    lorebooks,
    personas,
    providerConnectionId: thread.providerConnectionId,
    providerConnections,
    warningPrefix: "Roleplay thread",
  });

  return {
    activePersona: records.activePersona,
    companions: records.companions,
    lorebooks: records.lorebooks,
    providerConnectionId: records.providerConnectionId,
    providerConnection: records.providerConnection,
    requestThread: {
      ...thread,
      activePersonaId: records.activePersona?.id ?? null,
      characterIds: records.companions.map((companion) => companion.id),
      lorebookIds: records.lorebooks.map((lorebook) => lorebook.id),
      providerConnectionId: records.providerConnectionId,
    },
    warnings: records.warnings,
  };
}

function buildRoleplaySystemPrompt({
  activePersona,
  companions,
  lorebooks,
  targetCompanion,
  thread,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  targetCompanion: CharacterRecord | null;
  thread: RoleplayThread;
}) {
  const targetName = targetCompanion?.displayName ?? "the selected character";
  const userName = activePersona?.displayName ?? "the user";
  const selectedPrompt = replaceGenerationPromptMacros(
    DEFAULT_ROLEPLAY_SYSTEM_PROMPT,
    targetName,
    userName,
  );

  return [
    selectedPrompt,
    ...namedGenerationBlock("Scene", [
      thread.title ? `Title: ${thread.title}` : "",
      thread.sceneText ? thread.sceneText : "",
    ]),
    ...namedGenerationBlock(
      "Active persona",
      activePersona
        ? personaGenerationContext(activePersona, "Persona instructions")
        : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedGenerationBlock(
        companion.id === targetCompanion?.id
          ? "Replying character"
          : "Other character",
        characterGenerationContext(companion, {
          includeExamples: false,
          systemPromptLabel: "Character instructions",
        }),
      ),
    ),
    ...namedGenerationBlock(
      "Selected lore",
      loreGenerationContext(lorebooks, {
        includeSummary: true,
        scanSources: roleplayLoreScanSources(thread),
      }),
    ),
    ...namedGenerationBlock(
      "Example dialogue",
      exampleDialogueGenerationContext(companions),
    ),
  ].join("\n\n");
}

function buildPostHistoryPrompt({
  activePersona,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  targetCompanion: CharacterRecord | null;
}) {
  const targetName = targetCompanion?.displayName ?? "the selected character";
  const userName = activePersona?.displayName ?? "the user";

  return [
    `Continue the scene as ${targetName}.`,
    `Write only ${targetName}'s next turn. Do not write ${userName}'s response.`,
    targetCompanion?.postHistoryInstructions
      ? `Character post-history instructions: ${targetCompanion.postHistoryInstructions}`
      : "",
    activePersona?.postHistoryInstructions
      ? `Persona post-history instructions: ${activePersona.postHistoryInstructions}`
      : "",
  ]
    .filter((line) => line.trim())
    .join("\n");
}

function createRoleplayPromptMessages({
  activePersona,
  companions,
  lorebooks,
  thread,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  thread: RoleplayThread;
  targetCompanion: CharacterRecord | null;
}): RoleplayGenerationPromptMessage[] {
  const transcript = thread.entries
    .filter((entry) => entry.body.trim())
    .map((entry) => ({
      role: roleplayEntryRole(entry),
      content: roleplayEntryContent(entry),
    }));

  return [
    {
      role: "system",
      content: buildRoleplaySystemPrompt({
        activePersona,
        companions,
        lorebooks,
        targetCompanion,
        thread,
      }),
    },
    ...transcript,
    {
      role: "user",
      content: buildPostHistoryPrompt({ activePersona, targetCompanion }),
    },
  ];
}

export function createRoleplayGenerationRequest({
  context,
  id,
  now,
  parameters,
}: {
  context: RoleplayGenerationContext;
  id: string;
  now: string;
  parameters?: Partial<RoleplayGenerationParameters>;
}): RoleplayGenerationRequest {
  const targetCompanion = getNextRoleplayCompanion(
    context.requestThread,
    context.companions,
  );

  return {
    schemaVersion: 1,
    id,
    createdAt: now,
    thread: context.requestThread,
    companions: context.companions,
    activePersona: context.activePersona,
    lorebooks: context.lorebooks,
    providerConnectionId: context.providerConnectionId,
    providerConnection: context.providerConnection,
    targetCharacterId: targetCompanion?.id ?? null,
    targetCharacterName: targetCompanion?.displayName ?? null,
    promptMessages: createRoleplayPromptMessages({
      activePersona: context.activePersona,
      companions: context.companions,
      lorebooks: context.lorebooks,
      thread: context.requestThread,
      targetCompanion,
    }),
    parameters: createGenerationParameters(parameters, context.providerConnection),
  };
}
