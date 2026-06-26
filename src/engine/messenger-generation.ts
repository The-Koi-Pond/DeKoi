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

export type MessengerGenerationProviderKind =
  | "mock"
  | "remote-runtime"
  | "external-provider";

export interface MessengerGenerationPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MessengerGenerationParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
}

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

export interface MessengerGeneratedMessageDraft {
  characterId: string;
  body: string;
}

export interface MessengerGenerationResponse {
  schemaVersion: 1;
  requestId: string;
  providerKind: MessengerGenerationProviderKind;
  createdAt: string;
  messages: MessengerGeneratedMessageDraft[];
  warnings: string[];
}

export interface MessengerGenerationAdapter {
  providerKind: MessengerGenerationProviderKind;
  generate: (
    request: MessengerGenerationRequest,
  ) => Promise<MessengerGenerationResponse>;
}

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

function uniqueIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function missingRecordWarning(kind: string, id: string) {
  return `Messenger thread references a missing ${kind}: ${id}.`;
}

export function createMessengerGenerationContext({
  characters,
  fallbackProviderConnectionId = null,
  lorebooks,
  personas,
  providerConnections = [],
  thread,
}: MessengerGenerationContextInput): MessengerGenerationContext {
  const characterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const lorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook]),
  );
  const connectionIds = new Set(
    providerConnections.map((connection) => connection.id),
  );
  const warnings: string[] = [];

  const companions = uniqueIds(thread.characterIds).flatMap((characterId) => {
    const companion = characterById.get(characterId);
    if (companion) return [companion];
    warnings.push(missingRecordWarning("companion", characterId));
    return [];
  });

  const activePersona = thread.activePersonaId
    ? personaById.get(thread.activePersonaId) ?? null
    : null;
  if (thread.activePersonaId && !activePersona) {
    warnings.push(missingRecordWarning("persona", thread.activePersonaId));
  }

  const selectedLorebooks = uniqueIds(thread.lorebookIds).flatMap((lorebookId) => {
    const lorebook = lorebookById.get(lorebookId);
    if (lorebook) return [lorebook];
    warnings.push(missingRecordWarning("lorebook", lorebookId));
    return [];
  });

  let providerConnectionId = thread.providerConnectionId;
  let providerConnection: ProviderConnectionRecord | null = providerConnectionId
    ? (providerConnections.find((connection) => connection.id === providerConnectionId) ?? null)
    : null;
  if (providerConnectionId && !connectionIds.has(providerConnectionId)) {
    warnings.push(missingRecordWarning("provider connection", providerConnectionId));
    providerConnectionId = null;
    providerConnection = null;
  }

  if (!providerConnectionId && fallbackProviderConnectionId) {
    providerConnection =
      providerConnections.find((connection) => connection.id === fallbackProviderConnectionId) ??
      null;
    providerConnectionId = providerConnection?.id ?? null;
  }

  return {
    activePersona,
    companions,
    lorebooks: selectedLorebooks,
    providerConnectionId,
    providerConnection,
    requestThread: {
      ...thread,
      activePersonaId: activePersona?.id ?? null,
      characterIds: companions.map((companion) => companion.id),
      lorebookIds: selectedLorebooks.map((lorebook) => lorebook.id),
      mode: companions.length > 1 ? "group" : "direct",
      providerConnectionId,
    },
    warnings,
  };
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function namedBlock(title: string, lines: string[]) {
  const body = lines.filter((line) => line.trim()).join("\n");
  return body ? [`${title}\n${body}`] : [];
}

function characterContext(character: CharacterRecord) {
  return [
    `Name: ${character.displayName}`,
    character.nickname ? `Nickname: ${character.nickname}` : "",
    character.description ? `Description: ${character.description}` : "",
    character.personality ? `Personality: ${character.personality}` : "",
    character.scenario ? `Scenario: ${character.scenario}` : "",
    character.systemPrompt ? `System prompt: ${character.systemPrompt}` : "",
    character.exampleMessages ? `Example messages: ${character.exampleMessages}` : "",
    character.characterNote ? `Character note: ${character.characterNote}` : "",
  ].filter(Boolean);
}

function personaContext(persona: PersonaRecord) {
  return [
    `Name: ${persona.displayName}`,
    persona.nickname ? `Nickname: ${persona.nickname}` : "",
    persona.description ? `Description: ${persona.description}` : "",
    persona.personality ? `Personality: ${persona.personality}` : "",
    persona.scenario ? `Scenario: ${persona.scenario}` : "",
    persona.systemPrompt ? `System prompt: ${persona.systemPrompt}` : "",
    persona.characterNote ? `Persona note: ${persona.characterNote}` : "",
  ].filter(Boolean);
}

function loreContext(lorebooks: LorebookRecord[]) {
  return lorebooks.flatMap((lorebook) =>
    lorebook.entries
      .filter((entry) => entry.enabled && entry.body.trim())
      .map((entry) => `${lorebook.title} / ${entry.title}: ${entry.body.trim()}`),
  );
}

function messageRole(message: MessengerMessage): MessengerGenerationPromptMessage["role"] {
  return message.author.kind === "character" ? "assistant" : "user";
}

function messageContent(message: MessengerMessage) {
  const label = cleanText(message.author.label) || "Unknown";
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
  const selectedPrompt = resolveMessengerSystemPrompt(thread)
    .replaceAll("{{charName}}", targetName)
    .replaceAll("{{userName}}", userName);

  return [
    selectedPrompt,
    ...namedBlock(
      "Active persona",
      activePersona ? personaContext(activePersona) : ["Anonymous user"],
    ),
    ...companions.flatMap((companion) =>
      namedBlock(
        companion.id === targetCompanion?.id
          ? "Replying companion"
          : "Other companion",
        characterContext(companion),
      ),
    ),
    ...namedBlock("Selected lore", loreContext(lorebooks)),
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
    parameters: {
      temperature: parameters?.temperature ?? 0.8,
      maxTokens: parameters?.maxTokens ?? context.providerConnection?.maxOutput ?? 1024,
      topP: parameters?.topP ?? 0.95,
    },
  };
}
