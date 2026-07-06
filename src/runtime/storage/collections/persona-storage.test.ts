import { describe, expect, it } from "vitest";

import { normalizePersonaRecord } from "./persona-storage";

const now = "2026-07-02T00:00:00.000Z";

describe("normalizePersonaRecord", () => {
  it("does not read legacy persona aliases on the native load path", () => {
    const record = normalizePersonaRecord({
      id: "persona-1",
      schemaVersion: 1,
      displayName: "Alex",
      nickname: null,
      description: "",
      summary: "Legacy summary",
      personality: "",
      scenario: "",
      systemPrompt: "",
      postHistoryInstructions: "",
      creator: "",
      characterVersion: "",
      creatorNotes: "",
      tags: [],
      characterNote: "",
      characterNoteDepth: 4,
      characterNoteRole: "system",
      talkativeness: 50,
      avatarUrl: null,
      lorebookIds: [],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.personality).toBe("");
  });

  it("preserves persona lorebook bindings", () => {
    const record = normalizePersonaRecord({
      id: "persona-1",
      schemaVersion: 1,
      displayName: "Alex",
      nickname: null,
      description: "",
      personality: "",
      scenario: "",
      systemPrompt: "",
      postHistoryInstructions: "",
      creator: "",
      characterVersion: "",
      creatorNotes: "",
      tags: [],
      characterNote: "",
      characterNoteDepth: 4,
      characterNoteRole: "system",
      talkativeness: 50,
      avatarUrl: null,
      lorebookIds: ["lore-1", " lore-2 ", "", 42],
      createdAt: now,
      updatedAt: now,
    });

    expect(record?.lorebookIds).toEqual(["lore-1", "lore-2"]);
  });
});
