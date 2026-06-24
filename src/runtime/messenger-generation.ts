import type {
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../engine/messenger-generation";
import { createMessengerGenerationRequest } from "../engine/messenger-generation";
import {
  appendMessengerMessages,
  createGeneratedCompanionMessage,
} from "../engine/messenger-actions";
import type { CharacterRecord } from "../engine/character";
import type { LorebookRecord } from "../engine/lorebook";
import type { MessengerMessage, MessengerThread } from "../engine/messenger";
import type { PersonaRecord } from "../engine/persona";
import type { ProviderConnectionRecord } from "../engine/provider-connection";
import { mockMessengerGenerationAdapter } from "./mock-messenger-generation";
import { remoteMessengerGenerationAdapter } from "./remote-messenger-generation";

export type MessengerGenerationRuntimeMode = "mock" | "remote-runtime";

export interface MessengerGenerationRuntimeSnapshot {
  mode: MessengerGenerationRuntimeMode;
  label: string;
  adapter: MessengerGenerationAdapter;
}

export interface GenerateMessengerThreadReplyInput {
  thread: MessengerThread;
  userMessage: MessengerMessage;
  companions: CharacterRecord[];
  activePersona: PersonaRecord | null;
  lorebooks: LorebookRecord[];
  now: string;
  mode?: MessengerGenerationRuntimeMode;
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
      label: "Remote runtime generation",
      adapter: remoteMessengerGenerationAdapter,
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
  connection: ProviderConnectionRecord,
): MessengerGenerationRuntimeMode {
  return connection.kind === "remote-runtime" ? "remote-runtime" : "mock";
}

export async function generateMessengerResponse(
  request: MessengerGenerationRequest,
  mode: MessengerGenerationRuntimeMode = "mock",
): Promise<MessengerGenerationResponse> {
  const runtime = selectMessengerGenerationRuntime(mode);
  return runtime.adapter.generate(request);
}

export async function generateMessengerThreadReply({
  activePersona,
  companions,
  createId,
  lorebooks,
  mode = "mock",
  now,
  thread,
  userMessage,
}: GenerateMessengerThreadReplyInput): Promise<GenerateMessengerThreadReplyResult> {
  const runtime = selectMessengerGenerationRuntime(mode);
  const request = createMessengerGenerationRequest({
    activePersona,
    companions,
    id: createId("messenger-generation-request"),
    lorebooks,
    now,
    thread,
    userMessage,
  });
  const response = await generateMessengerResponse(request, runtime.mode);
  const generatedMessages = response.messages
    .map((messageDraft) => {
      const companion = companions.find(
        (candidate) => candidate.id === messageDraft.characterId,
      );
      if (!companion) return null;

      return createGeneratedCompanionMessage({
        body: messageDraft.body,
        companion,
        id: createId("messenger-message"),
        now: response.createdAt,
        thread,
      });
    })
    .filter((message): message is MessengerMessage => message !== null);

  return {
    thread:
      generatedMessages.length > 0
        ? appendMessengerMessages(thread, generatedMessages, response.createdAt)
        : thread,
    response,
    generatedMessages,
    runtimeMode: runtime.mode,
    runtimeLabel: runtime.label,
    warnings: response.warnings,
  };
}
