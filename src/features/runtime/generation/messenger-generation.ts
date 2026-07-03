import type {
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../../../engine/generation/messenger-generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
} from "../../../engine/generation/messenger-generation";
import {
  appendMessengerMessages,
  createGeneratedCompanionMessage,
} from "../../../engine/modes/messenger/messenger-actions";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import {
  getGenerationModeForConnection,
  selectGenerationRuntime,
  type GenerationRuntimeMode,
} from "./generation-runtime";
import { providerMessengerGenerationAdapter } from "./provider-messenger-generation";

export type MessengerGenerationRuntimeMode = GenerationRuntimeMode;

export interface MessengerGenerationRuntimeSnapshot {
  mode: MessengerGenerationRuntimeMode;
  label: string;
  adapter: MessengerGenerationAdapter;
}

export interface GenerateMessengerThreadReplyInput {
  thread: MessengerThread;
  userMessage: MessengerMessage;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  mode?: MessengerGenerationRuntimeMode;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createId: (prefix: string) => string;
}

export interface GenerateMessengerThreadReplyResult {
  thread: MessengerThread;
  response: MessengerGenerationResponse;
  generatedMessages: MessengerMessage[];
  runtimeMode: MessengerGenerationRuntimeMode;
  runtimeLabel: string;
  warnings: string[];
}

export function selectMessengerGenerationRuntime(
  mode: MessengerGenerationRuntimeMode = "remote-runtime",
): MessengerGenerationRuntimeSnapshot {
  const runtime = selectGenerationRuntime(mode);

  return {
    mode: runtime.mode,
    label: runtime.label,
    adapter: providerMessengerGenerationAdapter,
  };
}

export function getMessengerGenerationModeForConnection(
  connection: ProviderConnectionRecord | null | undefined,
): MessengerGenerationRuntimeMode {
  return getGenerationModeForConnection(connection);
}

async function generateMessengerResponse(
  request: MessengerGenerationRequest,
  mode: MessengerGenerationRuntimeMode = "remote-runtime",
): Promise<MessengerGenerationResponse> {
  const runtime = selectMessengerGenerationRuntime(mode);
  return runtime.adapter.generate(request);
}

export async function generateMessengerThreadReply({
  characters,
  createId,
  fallbackProviderConnectionId = null,
  lorebooks,
  mode = "remote-runtime",
  now,
  parameters,
  personas,
  providerConnections,
  thread,
  userMessage,
}: GenerateMessengerThreadReplyInput): Promise<GenerateMessengerThreadReplyResult> {
  const runtime = selectMessengerGenerationRuntime(mode);
  const context = createMessengerGenerationContext({
    characters,
    fallbackProviderConnectionId,
    lorebooks,
    personas,
    providerConnections,
    thread,
  });
  const request = createMessengerGenerationRequest({
    context,
    id: createId("messenger-generation-request"),
    now,
    parameters,
    userMessage,
  });
  const response = await generateMessengerResponse(request, runtime.mode);
  const droppedDraftWarnings: string[] = [];
  const generatedMessages = response.messages.flatMap((messageDraft) => {
    const companion = context.companions.find(
      (candidate) => candidate.id === messageDraft.characterId,
    );
    if (!companion) {
      droppedDraftWarnings.push(
        `Generation response referenced an unavailable companion: ${messageDraft.characterId}.`,
      );
      return [];
    }

    return [
      createGeneratedCompanionMessage({
        body: messageDraft.body,
        companion,
        id: createId("messenger-message"),
        now: response.createdAt,
        thread,
      }),
    ];
  });
  const warnings = [...response.warnings, ...droppedDraftWarnings, ...request.warnings];

  return {
    thread:
      generatedMessages.length > 0 ? appendMessengerMessages(thread, generatedMessages) : thread,
    response,
    generatedMessages,
    runtimeMode: runtime.mode,
    runtimeLabel: runtime.label,
    warnings,
  };
}
