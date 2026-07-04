import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
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
import type { GenerationRuntimeMode } from "./generation-runtime";
import {
  compactGenerationLoreRuntimeState,
  createGenerationLoreRuntimeState,
} from "./lore-runtime-state";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";

export interface GenerateRoleplayThreadTurnInput {
  thread: RoleplayThread;
  appSettings: AppSettings;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
  loreRuntimeState?: LoreRuntimeState | null;
  providerConnections: ProviderConnectionRecord[];
  fallbackProviderConnectionId?: string | null;
  now: string;
  mode?: GenerationRuntimeMode;
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
  warnings: string[];
  generatedEntryCount: number;
}

function providerErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown provider error.");
}

async function generateRoleplayResponse(
  request: ProviderGenerationRequest,
  mode: GenerationRuntimeMode = "remote-runtime",
): Promise<RoleplayGenerationResponse> {
  void mode;
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
  mode = "remote-runtime",
  now,
  parameters,
  personas,
  providerConnections,
  thread,
}: GenerateRoleplayThreadTurnInput): Promise<GenerateRoleplayThreadTurnResult> {
  const context = createRoleplayGenerationContext({
    appSettings,
    characters,
    fallbackProviderConnectionId,
    lorebooks,
    personas,
    providerConnections,
    thread,
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
  const response = await generateRoleplayResponse(request, mode);
  const droppedDraftWarnings: string[] = [];
  const entries = response.messages.flatMap((messageDraft) => {
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
      createGeneratedRoleplayEntry({
        body: messageDraft.body,
        companion,
        id: createId("roleplay-entry"),
        now: response.createdAt,
        thread,
      }),
    ];
  });
  const warnings = [...response.warnings, ...droppedDraftWarnings, ...request.warnings];

  return {
    thread: entries.length > 0 ? appendRoleplayEntries(thread, entries) : thread,
    loreRuntimeState: compactGenerationLoreRuntimeState(
      requestAssembly.loreRuntimeState,
      response.createdAt,
    ),
    warnings,
    generatedEntryCount: entries.length,
  };
}
