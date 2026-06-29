import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import {
  appendRoleplayEntries,
  createGeneratedRoleplayEntry,
} from "../../../engine/roleplay-actions";
import type { RoleplayThread } from "../../../engine/roleplay";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
  type RoleplayGenerationResponse,
} from "../../../engine/roleplay-generation";
import type { GenerationRuntimeMode } from "./generation-runtime";
import {
  generateWithConfiguredProvider,
  type ProviderGenerationRequest,
} from "./provider-generation";

export interface GenerateRoleplayThreadTurnInput {
  thread: RoleplayThread;
  characters: CharacterRecord[];
  personas: PersonaRecord[];
  lorebooks: LorebookRecord[];
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
  warnings: string[];
  generatedEntryCount: number;
}

function providerErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error ?? "Unknown provider error.");
}

async function generateRoleplayResponse(
  request: ProviderGenerationRequest,
  mode: GenerationRuntimeMode = "remote-runtime",
): Promise<RoleplayGenerationResponse> {
  void mode;
  try {
    return await generateWithConfiguredProvider(request);
  } catch (error) {
    throw new Error(
      `Provider Roleplay generation failed. ${providerErrorMessage(error)}`,
      { cause: error },
    );
  }
}

export async function generateRoleplayThreadTurn({
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
}: GenerateRoleplayThreadTurnInput): Promise<GenerateRoleplayThreadTurnResult> {
  const context = createRoleplayGenerationContext({
    characters,
    fallbackProviderConnectionId,
    lorebooks,
    personas,
    providerConnections,
    thread,
  });
  const request = createRoleplayGenerationRequest({
    context,
    id: createId("roleplay-generation-request"),
    now,
    parameters,
  });
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

  return {
    thread:
      entries.length > 0
        ? appendRoleplayEntries(thread, entries)
        : thread,
    warnings: [...context.warnings, ...response.warnings, ...droppedDraftWarnings],
    generatedEntryCount: entries.length,
  };
}
