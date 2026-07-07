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
import { createGeneratedDraftRecords } from "./generated-draft-records";
import {
  compactGenerationLoreRuntimeState,
  createGenerationLoreRuntimeState,
} from "./lore-runtime-state";
import {
  buildGenerationMacroVariableState,
  type MacroVariableStateCommit,
} from "../../../engine/macro-variables/macro-variable-actions";
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
  const macroVariableSelection = buildGenerationMacroVariableState({
    macroVariableStates,
    ownerId: thread.id,
    ownerKind: "roleplay-thread",
  });
  const context = createRoleplayGenerationContext({
    appSettings,
    characters,
    fallbackProviderConnectionId,
    lorebooks,
    personas,
    providerConnections,
    thread,
    variables: macroVariableSelection.variables,
  });
  const generationLoreRuntimeState = createGenerationLoreRuntimeState({
    createId,
    existingState: loreRuntimeState,
    now,
    ownerId: thread.id,
    ownerKind: "roleplay-thread",
  });
  const requestAssembly = createRoleplayGenerationRequestAssembly({
    context,
    id: createId("roleplay-generation-request"),
    loreRuntimeState: generationLoreRuntimeState,
    now,
    parameters,
  });
  const request = requestAssembly.request;
  const response = await generateRoleplayResponse(request);
  const draftRecords = createGeneratedDraftRecords({
    companions: context.companions,
    createRecord: ({ body, companion, id, now }) =>
      createGeneratedRoleplayEntry({
        body,
        companion,
        id,
        now,
        thread,
      }),
    nextId: () => createId("roleplay-entry"),
    response,
  });
  const entries = draftRecords.records;
  const warnings = [...response.warnings, ...draftRecords.warnings, ...request.warnings];
  const variableMutations = entries.length > 0 ? requestAssembly.macroVariableMutations : [];

  return {
    thread: entries.length > 0 ? appendRoleplayEntries(thread, entries) : thread,
    loreRuntimeState: compactGenerationLoreRuntimeState(
      requestAssembly.loreRuntimeState,
      response.createdAt,
    ),
    macroVariableCommit: {
      variableMutations,
      now: response.createdAt,
      ownerId: thread.id,
      ownerKind: "roleplay-thread",
      selection: macroVariableSelection,
    },
    warnings,
    generatedEntryCount: entries.length,
  };
}
