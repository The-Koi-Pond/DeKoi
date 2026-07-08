import type {
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../../../engine/generation/messenger-generation";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequestAssembly,
} from "../../../engine/generation/messenger-generation";
import {
  appendMessengerMessages,
  createGeneratedCompanionMessage,
} from "../../../engine/modes/messenger/messenger-actions";
import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { MessengerMessage, MessengerThread } from "../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { describeGenerationTransport } from "./generation-transport";
import { runGenerationWorkflow } from "./generation-workflow";
import type { MacroVariableStateCommit } from "../../../engine/macro-variables/macro-variable-actions";
import { providerMessengerGenerationAdapter } from "./provider-messenger-generation";
import { resolveGenerationTimeZone } from "./generation-time-zone";

export interface GenerateMessengerThreadReplyInput {
  thread: MessengerThread;
  appSettings: AppSettings;
  userMessage: MessengerMessage;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  loreRuntimeState?: LoreRuntimeState | null;
  macroVariableStates?: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  /**
   * IANA time zone override for display macros; omitted or `null` auto-detects
   * local time, falling back to resolver UTC when unavailable.
   */
  timeZone?: string | null;
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
  loreRuntimeState: LoreRuntimeState | null;
  macroVariableCommit: MacroVariableStateCommit;
  runtimeLabel: string;
  warnings: string[];
}

async function generateMessengerResponse(
  request: MessengerGenerationRequest,
): Promise<MessengerGenerationResponse> {
  return providerMessengerGenerationAdapter.generate(request);
}

export async function generateMessengerThreadReply({
  appSettings,
  characters,
  createId,
  fallbackProviderConnectionId = null,
  lorebooks,
  loreRuntimeState,
  macroVariableStates = [],
  now,
  parameters,
  personas,
  providerConnections,
  thread,
  timeZone,
  userMessage,
}: GenerateMessengerThreadReplyInput): Promise<GenerateMessengerThreadReplyResult> {
  const generationTransport = describeGenerationTransport();
  const generationTimeZone = resolveGenerationTimeZone(timeZone);
  const result = await runGenerationWorkflow({
    appendRecords: appendMessengerMessages,
    createContext: (variables) =>
      createMessengerGenerationContext({
        appSettings,
        characters,
        fallbackProviderConnectionId,
        lorebooks,
        personas,
        providerConnections,
        thread,
        variables,
      }),
    createId,
    createRecord: ({ body, companion, id, now }) =>
      createGeneratedCompanionMessage({
        body,
        companion,
        id,
        now,
        thread,
      }),
    createRequestAssembly: ({ context, id, loreRuntimeState }) =>
      createMessengerGenerationRequestAssembly({
        context,
        id,
        loreRuntimeState,
        now,
        parameters,
        timeZone: generationTimeZone,
        userMessage,
      }),
    existingLoreRuntimeState: loreRuntimeState,
    generateResponse: generateMessengerResponse,
    macroVariableStates,
    now,
    ownerKind: "messenger-thread",
    recordIdPrefix: "messenger-message",
    requestIdPrefix: "messenger-generation-request",
    thread,
  });

  return {
    thread: result.thread,
    response: result.response,
    generatedMessages: result.generatedRecords,
    loreRuntimeState: result.loreRuntimeState,
    macroVariableCommit: result.macroVariableCommit,
    runtimeLabel: generationTransport.label,
    warnings: result.warnings,
  };
}
