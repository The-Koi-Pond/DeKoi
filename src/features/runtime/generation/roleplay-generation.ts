import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../engine/contracts/types/macro-variables";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import {
  appendRoleplayEntries,
  createGeneratedRoleplayEntry,
} from "../../../engine/modes/roleplay/roleplay-actions";
import type { RoleplayThread } from "../../../engine/contracts/types/roleplay";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequestAssembly,
  type RoleplayGenerationResponse,
} from "../../../engine/generation/roleplay-generation";
import { runGenerationWorkflow } from "./generation-workflow";
import type { MacroVariableStateCommit } from "../../../engine/macro-variables/macro-variable-actions";
import {
  generateWithConfiguredProvider,
  providerErrorMessage,
  type ProviderGenerationRequest,
} from "./provider-generation";

export interface GenerateRoleplayThreadTurnInput {
  thread: RoleplayThread;
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  loreRuntimeState?: LoreRuntimeState | null;
  macroVariableStates?: MacroVariableScope[];
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  parameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  createId: (prefix: string) => string;
}

export interface GenerateRoleplayThreadTurnResult {
  thread: RoleplayThread;
  loreRuntimeState: LoreRuntimeState | null;
  macroVariableCommit: MacroVariableStateCommit;
  warnings: string[];
  generatedEntryCount: number;
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
  loreRuntimeState,
  macroVariableStates = [],
  now,
  parameters,
  personas,
  providerConnections,
  thread,
}: GenerateRoleplayThreadTurnInput): Promise<GenerateRoleplayThreadTurnResult> {
  const result = await runGenerationWorkflow({
    appendRecords: appendRoleplayEntries,
    createContext: (variables) =>
      createRoleplayGenerationContext({
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
      createGeneratedRoleplayEntry({
        body,
        companion,
        id,
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
      }),
    existingLoreRuntimeState: loreRuntimeState,
    generateResponse: generateRoleplayResponse,
    macroVariableStates,
    now,
    ownerKind: "roleplay-thread",
    recordIdPrefix: "roleplay-entry",
    requestIdPrefix: "roleplay-generation-request",
    thread,
  });

  return {
    thread: result.thread,
    loreRuntimeState: result.loreRuntimeState,
    macroVariableCommit: result.macroVariableCommit,
    warnings: result.warnings,
    generatedEntryCount: result.generatedRecords.length,
  };
}
