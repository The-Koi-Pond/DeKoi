import { describe, expect, it } from "vitest";
import type { ModeMessage } from "../../../../engine/contracts/types/mode-thread";
import { getCopyableMessageBody } from "./message-view";

function createMessage(body: string): ModeMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: "thread-1",
    author: {
      kind: "persona",
      personaId: "persona-1",
      label: "Persona",
    },
    branchId: "branch-1",
    versions: [
      {
        id: "version-1",
        body,
        origin: "manual",
        createdAt: "2026-07-04T00:00:00.000Z",
        updatedAt: "2026-07-04T00:00:00.000Z",
      },
    ],
    activeVersionId: "version-1",
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
