import type { CharacterRecord } from "./character";
import type { LorebookRecord } from "./lorebook";
import type { PersonaRecord } from "./persona";
import type { ProviderConnectionRecord } from "./provider-connection";

export type GenerationProviderKind =
  | "mock"
  | "remote-runtime"
  | "external-provider";

export interface GenerationPromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerationParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
}

export interface GeneratedMessageDraft {
  characterId: string;
  body: string;
}

export interface GenerationResponse {
  schemaVersion: 1;
  requestId: string;
  providerKind: GenerationProviderKind;
  createdAt: string;
  messages: GeneratedMessageDraft[];
  warnings: string[];
}

export interface GenerationRequestBase {
  id: string;
  createdAt: string;
  providerConnection: ProviderConnectionRecord | null;
  targetCharacterId: string | null;
  targetCharacterName: string | null;
  promptMessages: GenerationPromptMessage[];
  parameters: GenerationParameters;
}

export interface GenerationAdapter<Request extends GenerationRequestBase> {
  providerKind: GenerationProviderKind;
  generate: (request: Request) => Promise<GenerationResponse>;
}

export interface GenerationRecordContext {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  lorebooks: LorebookRecord[];
  providerConnectionId: string | null;
  providerConnection: ProviderConnectionRecord | null;
  warnings: string[];
}

export interface ResolveGenerationRecordsInput {
  activePersonaId: string | null;
  characterIds: string[];
  lorebookIds: string[];
  providerConnectionId: string | null;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections?: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  warningPrefix: string;
}

export function cleanGenerationText(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function uniqueGenerationIds(ids: string[]) {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export function createGenerationWarning(prefix: string, kind: string, id: string) {
  return `${prefix} references a missing ${kind}: ${id}.`;
}

export function namedGenerationBlock(title: string, lines: string[]) {
  const body = lines.filter((line) => line.trim()).join("\n");
  return body ? [`${title}\n${body}`] : [];
}

export function replaceGenerationPromptMacros(
  prompt: string,
  targetName: string,
  userName: string,
) {
  return prompt
    .replaceAll("{{charName}}", targetName)
    .replaceAll("{{char}}", targetName)
    .replaceAll("{{userName}}", userName)
    .replaceAll("{{user}}", userName);
}

export function characterGenerationContext(
  character: CharacterRecord,
  options: { includeExamples?: boolean; systemPromptLabel?: string } = {},
) {
  const systemPromptLabel = options.systemPromptLabel ?? "System prompt";
  const includeExamples = options.includeExamples ?? true;

  return [
    `Name: ${character.displayName}`,
    character.nickname ? `Nickname: ${character.nickname}` : "",
    character.description ? `Description: ${character.description}` : "",
    character.personality ? `Personality: ${character.personality}` : "",
    character.scenario ? `Scenario: ${character.scenario}` : "",
    character.systemPrompt
      ? `${systemPromptLabel}: ${character.systemPrompt}`
      : "",
    includeExamples && character.exampleMessages
      ? `Example messages: ${character.exampleMessages}`
      : "",
    character.characterNote ? `Character note: ${character.characterNote}` : "",
  ].filter(Boolean);
}

export function personaGenerationContext(
  persona: PersonaRecord,
  systemPromptLabel = "System prompt",
) {
  return [
    `Name: ${persona.displayName}`,
    persona.nickname ? `Nickname: ${persona.nickname}` : "",
    persona.description ? `Description: ${persona.description}` : "",
    persona.personality ? `Personality: ${persona.personality}` : "",
    persona.scenario ? `Scenario: ${persona.scenario}` : "",
    persona.systemPrompt ? `${systemPromptLabel}: ${persona.systemPrompt}` : "",
    persona.characterNote ? `Persona note: ${persona.characterNote}` : "",
  ].filter(Boolean);
}

export function loreGenerationContext(
  lorebooks: LorebookRecord[],
  options: { includeSummary?: boolean } = {},
) {
  return lorebooks.flatMap((lorebook) => [
    ...(options.includeSummary && lorebook.summary.trim()
      ? [`${lorebook.title}: ${lorebook.summary.trim()}`]
      : []),
    ...lorebook.entries
      .filter((entry) => entry.enabled && entry.body.trim())
      .map((entry) => `${lorebook.title} / ${entry.title}: ${entry.body.trim()}`),
  ]);
}

export function exampleDialogueGenerationContext(companions: CharacterRecord[]) {
  return companions.flatMap((companion) =>
    companion.exampleMessages.trim()
      ? [`${companion.displayName}\n${companion.exampleMessages.trim()}`]
      : [],
  );
}

export function createGenerationParameters(
  parameters: Partial<GenerationParameters> | undefined,
  providerConnection: ProviderConnectionRecord | null,
): GenerationParameters {
  return {
    temperature: parameters?.temperature ?? 0.8,
    maxTokens: parameters?.maxTokens ?? providerConnection?.maxOutput ?? 1024,
    topP: parameters?.topP ?? 0.95,
  };
}

export function resolveGenerationRecords({
  activePersonaId,
  characterIds,
  characters,
  fallbackProviderConnectionId = null,
  lorebookIds,
  lorebooks,
  personas,
  providerConnectionId,
  providerConnections = [],
  warningPrefix,
}: ResolveGenerationRecordsInput): GenerationRecordContext {
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

  const companions = uniqueGenerationIds(characterIds).flatMap((characterId) => {
    const companion = characterById.get(characterId);
    if (companion) return [companion];
    warnings.push(createGenerationWarning(warningPrefix, "companion", characterId));
    return [];
  });

  const activePersona = activePersonaId
    ? personaById.get(activePersonaId) ?? null
    : null;
  if (activePersonaId && !activePersona) {
    warnings.push(createGenerationWarning(warningPrefix, "persona", activePersonaId));
  }

  const selectedLorebooks = uniqueGenerationIds(lorebookIds).flatMap(
    (lorebookId) => {
      const lorebook = lorebookById.get(lorebookId);
      if (lorebook) return [lorebook];
      warnings.push(createGenerationWarning(warningPrefix, "lorebook", lorebookId));
      return [];
    },
  );

  let selectedProviderConnectionId = providerConnectionId;
  let providerConnection: ProviderConnectionRecord | null =
    selectedProviderConnectionId
      ? (providerConnections.find(
          (connection) => connection.id === selectedProviderConnectionId,
        ) ?? null)
      : null;
  if (
    selectedProviderConnectionId &&
    !connectionIds.has(selectedProviderConnectionId)
  ) {
    warnings.push(
      createGenerationWarning(
        warningPrefix,
        "provider connection",
        selectedProviderConnectionId,
      ),
    );
    selectedProviderConnectionId = null;
    providerConnection = null;
  }

  if (!selectedProviderConnectionId && fallbackProviderConnectionId) {
    providerConnection =
      providerConnections.find(
        (connection) => connection.id === fallbackProviderConnectionId,
      ) ?? null;
    selectedProviderConnectionId = providerConnection?.id ?? null;
  }

  return {
    activePersona,
    companions,
    lorebooks: selectedLorebooks,
    providerConnectionId: selectedProviderConnectionId,
    providerConnection,
    warnings,
  };
}
