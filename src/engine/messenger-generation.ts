import type { CharacterRecord } from "./character";
import type { LorebookRecord } from "./lorebook";
import type { MessengerMessage, MessengerThread } from "./messenger";
import type { PersonaRecord } from "./persona";
import type { ProviderConnectionRecord } from "./provider-connection";

export type MessengerGenerationProviderKind =
  | "mock"
  | "remote-runtime"
  | "external-provider";

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
  if (providerConnectionId && !connectionIds.has(providerConnectionId)) {
    warnings.push(missingRecordWarning("provider connection", providerConnectionId));
    providerConnectionId = null;
  }

  if (!providerConnectionId && fallbackProviderConnectionId) {
    providerConnectionId = connectionIds.has(fallbackProviderConnectionId)
      ? fallbackProviderConnectionId
      : null;
  }

  return {
    activePersona,
    companions,
    lorebooks: selectedLorebooks,
    providerConnectionId,
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

export function createMessengerGenerationRequest({
  context,
  id,
  now,
  userMessage,
}: {
  context: MessengerGenerationContext;
  id: string;
  now: string;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
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
  };
}
