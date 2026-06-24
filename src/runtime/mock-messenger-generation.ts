import type {
  MessengerGenerationAdapter,
  MessengerGenerationRequest,
  MessengerGenerationResponse,
} from "../engine/messenger-generation";
import { getNextMessengerCompanion } from "../engine/messenger-actions";

function getMockReplyText(request: MessengerGenerationRequest) {
  const trimmedBody = request.userMessage.body.trim();
  const enabledLoreCount = request.lorebooks.reduce(
    (count, lorebook) =>
      count + lorebook.entries.filter((entry) => entry.enabled).length,
    0,
  );

  if (trimmedBody.endsWith("?")) {
    return `Mock reply: I can answer from the local generation contract now. ${enabledLoreCount} lore notes are available for context.`;
  }

  if (trimmedBody.length > 120) {
    return "Mock reply: I kept the shape of your longer message and routed it through the generation adapter boundary.";
  }

  return "Mock reply: this response came through DeKoi's provider-neutral Messenger generation path.";
}

export const mockMessengerGenerationAdapter: MessengerGenerationAdapter = {
  providerKind: "mock",
  async generate(
    request: MessengerGenerationRequest,
  ): Promise<MessengerGenerationResponse> {
    const companion = getNextMessengerCompanion(
      request.thread,
      request.companions,
    );

    return {
      schemaVersion: 1,
      requestId: request.id,
      providerKind: "mock",
      createdAt: new Date().toISOString(),
      messages: companion
        ? [
            {
              characterId: companion.id,
              body: getMockReplyText(request),
            },
          ]
        : [],
      warnings: companion ? [] : ["No companion is available for this thread."],
    };
  },
};
