import type {
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../../../engine/messenger-generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
} from "../../../engine/messenger-generation";
import {
  appendMessengerMessages,
  createGeneratedCompanionMessage,
} from "../../../engine/messenger-actions";
import type { CharacterRecord } from "../../../engine/character";
import type { LorebookRecord } from "../../../engine/lorebook";
import type { MessengerMessage, MessengerThread } from "../../../engine/messenger";
import type { PersonaRecord } from "../../../engine/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import { mockMessengerGenerationAdapter } from "./mock-messenger-generation";
import { providerMessengerGenerationAdapter } from "./provider-messenger-generation";

export type MessengerGenerationRuntimeMode = "mock" | "remote-runtime";

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

export function isMessengerGenerationRuntimeMode(
  value: unknown,
): value is MessengerGenerationRuntimeMode {
  return value === "mock" || value === "remote-runtime";
}

export function selectMessengerGenerationRuntime(
  mode: MessengerGenerationRuntimeMode = "mock",
): MessengerGenerationRuntimeSnapshot {
  if (mode === "remote-runtime") {
    return {
      mode: "remote-runtime",
      label: "Provider generation",
      adapter: providerMessengerGenerationAdapter,
    };
  }

  if (mode !== "mock") {
    return {
      mode: "mock",
      label: "Mock generation",
      adapter: mockMessengerGenerationAdapter,
    };
  }

  return {
    mode: "mock",
    label: "Mock generation",
    adapter: mockMessengerGenerationAdapter,
  };
}

export function getMessengerGenerationModeForConnection(
  connection: ProviderConnectionRecord | null | undefined,
): MessengerGenerationRuntimeMode {
  return connection?.kind === "remote-runtime" ? "remote-runtime" : "mock";
}

export async function generateMessengerResponse(
  request: MessengerGenerationRequest,
  mode: MessengerGenerationRuntimeMode = "mock",
): Promise<MessengerGenerationResponse> {
  const runtime = selectMessengerGenerationRuntime(mode);
  return runtime.adapter.generate(request);
}

export async function generateMessengerThreadReply({
  characters,
  createId,
  fallbackProviderConnectionId = null,
  lorebooks,
  mode = "mock",
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

  return {
    thread:
      generatedMessages.length > 0
        ? appendMessengerMessages(thread, generatedMessages, response.createdAt)
        : thread,
    response,
    generatedMessages,
    runtimeMode: runtime.mode,
    runtimeLabel: runtime.label,
    warnings: [...context.warnings, ...response.warnings, ...droppedDraftWarnings],
  };
}
