import { describe, expect, it } from "vitest";
import type { RoleplayEntry } from "../../../../engine/contracts/types/roleplay";
import { getCopyableRoleplayEntryBody } from "./message-view";

function createEntry(body: string): RoleplayEntry {
  return {
    id: "entry-1",
    schemaVersion: 1,
    threadId: "thread-1",
    role: "narration",
    characterId: null,
    personaId: null,
    label: "Narrator",
    body,
    origin: "manual",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

describe("getCopyableRoleplayEntryBody", () => {
  it("preserves scene-formatting whitespace", () => {
    const body = "  The room goes quiet.\n\n";

    expect(getCopyableRoleplayEntryBody(createEntry(body))).toBe(body);
  });

  it("returns null for whitespace-only entries", () => {
    expect(getCopyableRoleplayEntryBody(createEntry(" \n\t "))).toBeNull();
  });
});
