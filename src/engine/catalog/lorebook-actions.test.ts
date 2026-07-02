import { describe, expect, it } from "vitest";

import {
  createLorebookEntryRecord,
  updateLorebookEntryRecord,
} from "./lorebook-actions";

describe("lorebook entry actions", () => {
  it("lets callers clear an entry body while preserving omitted optional blocks", () => {
    const entry = createLorebookEntryRecord({
      id: "entry-under-test",
      input: {
        title: "Defaulted Entry",
        body: "Entry body.",
      },
      now: "2026-06-24T07:00:00.000Z",
    });

    const updated = updateLorebookEntryRecord(
      entry,
      {
        title: entry.title,
        body: "",
      },
      "2026-06-24T08:00:00.000Z",
    );

    expect(updated.body).toBe("");
    expect(updated.recursion).toBeNull();
    expect(updated.timing).toBeNull();
    expect(updated.triggers).toBeNull();
    expect(updated.characterFilter).toBeNull();
    expect(updated.matchSources).toBeNull();
  });
});
