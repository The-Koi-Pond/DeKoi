import { describe, expect, it } from "vitest";
import type { ModeMessage } from "../../../../engine/contracts/types/mode-thread";
import { getCopyableRoleplayMessageBody } from "./message-view";

function createMessage(body: string): ModeMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: "thread-1",
    branchId: "branch-1",
    author: { kind: "system", label: "Scene" },
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

describe("getCopyableRoleplayMessageBody", () => {
  it("preserves scene-formatting whitespace", () => {
    const body = "  The room goes quiet.\n\n";
    expect(getCopyableRoleplayMessageBody(createMessage(body))).toBe(body);
  });
  it("returns null for whitespace-only messages", () => {
    expect(getCopyableRoleplayMessageBody(createMessage(" \n\t "))).toBeNull();
  });
});
