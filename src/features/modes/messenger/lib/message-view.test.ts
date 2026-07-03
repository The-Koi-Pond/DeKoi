import { describe, expect, it } from "vitest";
import type { MessengerMessage } from "../../../../engine/contracts/types/messenger";
import { getCopyableMessageBody } from "./message-view";

function createMessage(body: string): MessengerMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: "thread-1",
    author: {
      kind: "persona",
      personaId: "persona-1",
      label: "Persona",
    },
    body,
    origin: "manual",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

describe("getCopyableMessageBody", () => {
  it("preserves intentional surrounding whitespace", () => {
    const body = "\n  hello there  \n";

    expect(getCopyableMessageBody(createMessage(body))).toBe(body);
  });

  it("returns null for whitespace-only messages", () => {
    expect(getCopyableMessageBody(createMessage(" \n\t "))).toBeNull();
  });
});
