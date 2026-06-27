import type { CharacterRecord } from "./character";
import type { LorebookRecord } from "./lorebook";
import {
  resolveMessengerSystemPrompt,
  type MessengerMessage,
  type MessengerThread,
} from "./messenger";
import { getNextMessengerCompanion } from "./messenger-actions";
import type { PersonaRecord } from "./persona";
import type { ProviderConnectionRecord } from "./provider-connection";
import {
  characterGenerationContext,
  cleanGenerationText,
  createGenerationParameters,
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

export type MessengerGenerationProviderKind = GenerationProviderKind;
export type MessengerGenerationPromptMessage = GenerationPromptMessage;
export type MessengerGenerationParameters = GenerationParameters;

export interface MessengerGenerationRequest {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  thread: MessengerThread;
  userMessage: MessengerMessage;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: MessengerGenerationPromptMessage[];
  parameters: MessengerGenerationParameters;
}

export type MessengerGeneratedMessageDraft = GeneratedMessageDraft;
export type MessengerGenerationResponse = GenerationResponse;

export type MessengerGenerationAdapter = GenerationAdapter<MessengerGenerationRequest>;

export interface MessengerGenerationContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  requestThread: MessengerThread;
  warnings: string[];
}

export interface MessengerGenerationContextInput {
  thread: MessengerThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
}

export function createMessengerGenerationContext({
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: MessengerGenerationContextInput): MessengerGenerationContext {
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
    warningPrefix: "Messenger thread",
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
      mode: records.companions.length > 1 ? "group" : "direct",
      providerConnectionId: records.providerConnectionId,
    },
    warnings: records.warnings,
  };
}

function messageRole(message: MessengerMessage): MessengerGenerationPromptMessage["role"] {
  return message.author.kind === "character" ? "assistant" : "user";
}

function messageContent(message: MessengerMessage) {
  const label = cleanGenerationText(message.author.label) || "Unknown";
  return `${label}: ${message.body.trim()}`;
}

function buildSystemPrompt({
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
  thread: MessengerThread;
}) {
  const targetName = targetCompanion?.displayName ?? "the selected companion";
  const userName = activePersona?.displayName ?? "the user";
  const selectedPrompt = replaceGenerationPromptMacros(
    resolveMessengerSystemPrompt(thread),
    targetName,
    userName,
  );

  return [
    selectedPrompt,
    ...namedGenerationBlock(
      "Active persona",
      activePersona ? personaGenerationContext(activePersona) : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedGenerationBlock(
        companion.id === targetCompanion?.id
          ? "Replying companion"
          : "Other companion",
        characterGenerationContext(companion),
      ),
    ),
    ...namedGenerationBlock("Selected lore", loreGenerationContext(lorebooks)),
    ...(targetCompanion?.postHistoryInstructions
      ? [`Post-history instructions\n${targetCompanion.postHistoryInstructions}`]
      : []),
    ...(activePersona?.postHistoryInstructions
      ? [`Persona post-history instructions\n${activePersona.postHistoryInstructions}`]
      : []),
  ].join("\n\n");
}

function createMessengerPromptMessages({
  activePersona,
  companions,
  lorebooks,
  thread,
  targetCompanion,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  thread: MessengerThread;
  targetCompanion: CharacterRecord | null;
}): MessengerGenerationPromptMessage[] {
  const transcript = thread.messages
    .filter((message) => message.body.trim())
    .map((message) => ({
      role: messageRole(message),
      content: messageContent(message),
    }));

  return [
    {
      role: "system",
      content: buildSystemPrompt({
        activePersona,
        companions,
        lorebooks,
        targetCompanion,
        thread,
      }),
    },
    ...transcript,
  ];
}

export function createMessengerGenerationRequest({
  context,
  id,
  now,
  parameters,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  now: string;
  parameters?: Partial<MessengerGenerationParameters>;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
  const targetCompanion = getNextMessengerCompanion(
    context.requestThread,
    context.companions,
  );

  return {
    schemaVersion: 1,
    id,
    createdAt: now,
    thread: context.requestThread,
    userMessage,
    companions: context.companions,
    activePersona: context.activePersona,
    lorebooks: context.lorebooks,
    providerConnectionId: context.providerConnectionId,
    providerConnection: context.providerConnection,
    targetCharacterId: targetCompanion?.id ?? null,
    targetCharacterName: targetCompanion?.displayName ?? null,
    promptMessages: createMessengerPromptMessages({
      activePersona: context.activePersona,
      companions: context.companions,
      lorebooks: context.lorebooks,
      thread: context.requestThread,
      targetCompanion,
    }),
    parameters: createGenerationParameters(parameters, context.providerConnection),
  };
}
