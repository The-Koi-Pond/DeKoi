import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import {
  appendRoleplayMessages,
  createGeneratedRoleplayMessage,
} from "../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayModeThread, ModeMessage } from "../../../engine/contracts/types/mode-thread";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
  type RoleplayGenerationContext,
  type RoleplayGenerationRequest,
  type RoleplayGenerationResponse,
} from "../../../engine/generation/roleplay-generation";
import { runGenerationWorkflow } from "./generation-workflow";
import type { MacroVariableStateCommit } from "../../../engine/macro-variables/macro-variable-actions";
import {
  generateWithConfiguredProvider,
  providerErrorMessage,
  type ProviderGenerationRequest,
} from "./provider-generation";
import { resolveGenerationTimeZone } from "./generation-time-zone";

export interface GenerateRoleplayThreadTurnInput {
  thread: RoleplayModeThread;
  appSettings: AppSettings;
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

export interface GenerateRoleplayThreadTurnResult {
  thread: RoleplayModeThread;
  loreRuntimeState: LoreRuntimeState | null;
  macroVariableCommit: MacroVariableStateCommit;
  warnings: string[];
  generatedMessages: ModeMessage[];
  generatedMessageCount: number;
}

async function generateRoleplayResponse(
  request: ProviderGenerationRequest,
): Promise<RoleplayGenerationResponse> {
  try {
    return await generateWithConfiguredProvider(request);
  } catch (error) {
    throw new Error(`Provider Roleplay generation failed. ${providerErrorMessage(error)}`, {
      cause: error,
    });
  }
}

export async function generateRoleplayThreadTurn({
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
}: GenerateRoleplayThreadTurnInput): Promise<GenerateRoleplayThreadTurnResult> {
  const generationTimeZone = resolveGenerationTimeZone(timeZone);
  const result = await runGenerationWorkflow<
    RoleplayModeThread,
    RoleplayGenerationContext,
    RoleplayGenerationRequest,
    RoleplayGenerationResponse,
    ModeMessage
  >({
    appendRecords: (target, records, branchId) => appendRoleplayMessages(target, records, branchId),
    createContext: (variables) =>
      createRoleplayGenerationContext({
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
      createGeneratedRoleplayMessage({
        body,
        companion,
        id,
        versionId,
        now,
        thread,
      }),
    createRequestAssembly: ({ context, id, loreRuntimeState }) =>
      createRoleplayGenerationRequestAssembly({
        context,
        id,
        loreRuntimeState,
        now,
        parameters,
        timeZone: generationTimeZone,
      }),
    existingLoreRuntimeState: loreRuntimeState,
    generateResponse: generateRoleplayResponse,
    macroVariableStates,
    now,
    ownerKind: "mode-branch",
    recordIdPrefix: "roleplay-message",
    versionIdPrefix: "roleplay-message-version",
    requestIdPrefix: "roleplay-generation-request",
    thread,
  });

  return {
    thread: result.thread,
    loreRuntimeState: result.loreRuntimeState,
    macroVariableCommit: result.macroVariableCommit,
    warnings: result.warnings,
    generatedMessages: result.generatedRecords,
    generatedMessageCount: result.generatedRecords.length,
  };
}
