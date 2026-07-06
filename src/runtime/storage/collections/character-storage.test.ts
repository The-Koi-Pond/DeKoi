import { describe, expect, it } from "vitest";

import { normalizeCharacterRecord } from "./character-storage";

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeCharacterRecord", () => {
  it("does not read legacy character aliases on the native load path", () => {
    const record = normalizeCharacterRecord({
      id: "character-1",
      schemaVersion: 1,
      displayName: "Mara",
      shortName: "Mars",
      nickname: null,
      description: "",
      summary: "Legacy summary",
      personality: "",
      scenario: "",
      firstMessage: "",
      alternateGreetings: [],
      groupOnlyGreetings: [],
      exampleMessages: "",
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

    expect(record?.nickname).toBeNull();
    expect(record?.personality).toBe("");
  });
});
