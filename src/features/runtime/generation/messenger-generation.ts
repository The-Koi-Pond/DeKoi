import type {
  MessengerGenerationRequest,
  MessengerGenerationContext,
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
import type { MessengerModeThread, ModeMessage } from "../../../engine/contracts/types/mode-thread";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { describeGenerationTransport } from "./generation-transport";
import { runGenerationWorkflow } from "./generation-workflow";
import type { MacroVariableStateCommit } from "../../../engine/macro-variables/macro-variable-actions";
import { providerMessengerGenerationAdapter } from "./provider-messenger-generation";
import { resolveGenerationTimeZone } from "./generation-time-zone";

export interface GenerateMessengerThreadReplyInput {
  thread: MessengerModeThread;
  appSettings: AppSettings;
  userMessage: ModeMessage;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  promptPresets?: PromptPresetRecord[];
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
  thread: MessengerModeThread;
  response: MessengerGenerationResponse;
  generatedMessages: ModeMessage[];
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
  promptPresets = [],
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
  const result = await runGenerationWorkflow<
    MessengerModeThread,
    MessengerGenerationContext,
    MessengerGenerationRequest,
    MessengerGenerationResponse,
    ModeMessage
  >({
    appendRecords: (target, records, branchId) =>
      appendMessengerMessages(target, records, branchId),
    createContext: (variables) =>
      createMessengerGenerationContext({
        appSettings,
        characters,
        fallbackProviderConnectionId,
        lorebooks,
        personas,
        promptPresets,
        providerConnections,
        thread,
        variables,
      }),
    createId,
    createRecord: ({ body, companion, id, now, versionId }) =>
      createGeneratedCompanionMessage({
        body,
        companion,
        id,
        versionId,
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
    ownerKind: "mode-branch",
    recordIdPrefix: "messenger-message",
    versionIdPrefix: "messenger-message-version",
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
