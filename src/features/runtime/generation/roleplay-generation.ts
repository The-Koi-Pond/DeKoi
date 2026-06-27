import type { CharacterRecord } from "../../../engine/character";
import type { LorebookRecord } from "../../../engine/lorebook";
import type { PersonaRecord } from "../../../engine/persona";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import {
  appendRoleplayEntries,
  createGeneratedRoleplayEntry,
} from "../../../engine/roleplay-actions";
import type { RoleplayThread } from "../../../engine/roleplay";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
  type RoleplayGenerationRequest,
  type RoleplayGenerationResponse,
} from "../../../engine/roleplay-generation";
import type { GenerationRuntimeMode } from "./generation-runtime";
import { generateWithConfiguredProvider } from "./provider-generation";

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

function createMockRoleplayResponse(
  request: RoleplayGenerationRequest,
): RoleplayGenerationResponse {
  const targetCharacterId = request.targetCharacterId;
  const targetName = request.targetCharacterName ?? "Companion";

  if (!targetCharacterId) {
    return {
      schemaVersion: 1,
      requestId: request.id,
      providerKind: "mock",
      createdAt: request.createdAt,
      messages: [],
      warnings: ["No companion is available for this Roleplay thread."],
    };
  }

  const personaName = request.activePersona?.displayName ?? "Anonymous";
  const selectedLoreCount = request.lorebooks.reduce(
    (count, lorebook) =>
      count +
      lorebook.entries.filter((entry) => entry.enabled && entry.body.trim()).length,
    0,
  );
  const sceneLabel = request.thread.sceneText.trim()
    ? "the active scene text"
    : request.thread.title;

  return {
    schemaVersion: 1,
    requestId: request.id,
    providerKind: "mock",
    createdAt: request.createdAt,
    messages: [
      {
        characterId: targetCharacterId,
        body: `Mock Roleplay reply from ${targetName}: I am responding to ${personaName} using ${sceneLabel} and ${selectedLoreCount} selected lore notes.`,
      },
    ],
    warnings: [],
  };
}

async function generateRoleplayResponse(
  request: RoleplayGenerationRequest,
  mode: GenerationRuntimeMode = "mock",
): Promise<RoleplayGenerationResponse> {
  if (mode !== "remote-runtime") {
    return createMockRoleplayResponse(request);
  }

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
  mode = "mock",
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
        ? appendRoleplayEntries(thread, entries, response.createdAt)
        : thread,
    warnings: [...context.warnings, ...response.warnings, ...droppedDraftWarnings],
    generatedEntryCount: entries.length,
  };
}
