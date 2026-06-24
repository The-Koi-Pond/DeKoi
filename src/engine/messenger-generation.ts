import type { CharacterRecord } from "./character";
import type { LorebookRecord } from "./lorebook";
import type { MessengerMessage, MessengerThread } from "./messenger";
import type { PersonaRecord } from "./persona";

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

export function createMessengerGenerationRequest({
  activePersona,
  companions,
  id,
  lorebooks,
  now,
  thread,
  userMessage,
}: {
  activePersona: PersonaRecord | null;
  companions: CharacterRecord[];
  id: string;
  lorebooks: LorebookRecord[];
  now: string;
  thread: MessengerThread;
  userMessage: MessengerMessage;
}): MessengerGenerationRequest {
  return {
    schemaVersion: 1,
    id,
    createdAt: now,
    thread,
    userMessage,
    companions,
    activePersona,
    lorebooks,
    providerConnectionId: thread.providerConnectionId,
  };
}
