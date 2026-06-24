import type {
  MessengerGeneratedMessageDraft,
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../engine/messenger-generation";
import { getNextMessengerCompanion } from "../engine/messenger-actions";
import type { CharacterRecord } from "../engine/character";

function getMockReplyText(
  request: MessengerGenerationRequest,
  companion: CharacterRecord,
) {
  const trimmedBody = request.userMessage.body.trim();
  const enabledLoreEntries = request.lorebooks.flatMap((lorebook) =>
    lorebook.entries
      .filter((entry) => entry.enabled)
      .map((entry) => `${lorebook.title}: ${entry.title}`),
  );
  const companionName = companion.shortName ?? companion.displayName;
  const personaName = request.activePersona?.displayName ?? "no persona";
  const loreSummary =
    enabledLoreEntries.length > 0
      ? `${enabledLoreEntries.length} lore notes, including ${enabledLoreEntries[0]}, are available.`
      : "No enabled lore notes are selected.";

  if (trimmedBody.endsWith("?")) {
    return `Mock reply from ${companionName}: I can answer ${personaName} through the local generation contract. ${loreSummary}`;
  }

  if (trimmedBody.length > 120) {
    return `Mock reply from ${companionName}: I kept the shape of your longer message and routed it with ${request.companions.length} selected companion records.`;
  }

  return `Mock reply from ${companionName}: this response used the selected Messenger thread context for ${personaName}. ${loreSummary}`;
}

function createMockMessageDraft(
  request: MessengerGenerationRequest,
): MessengerGeneratedMessageDraft | null {
  const companion = getNextMessengerCompanion(
    request.thread,
    request.companions,
  );
  if (!companion) return null;

  return {
    characterId: companion.id,
    body: getMockReplyText(request, companion),
  };
}

export const mockMessengerGenerationAdapter: MessengerGenerationAdapter = {
  providerKind: "mock",
  async generate(
    request: MessengerGenerationRequest,
  ): Promise<MessengerGenerationResponse> {
    const message = createMockMessageDraft(request);

    return {
      schemaVersion: 1,
      requestId: request.id,
      providerKind: "mock",
      createdAt: request.createdAt,
      messages: message ? [message] : [],
      warnings: message ? [] : ["No companion is available for this thread."],
    };
  },
};
