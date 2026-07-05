import { describe, expect, it } from "vitest";

import {
  APP_STORAGE_COLLECTION_KEYS,
  summarizeAppStorageDroppedRecords,
} from "./app-storage-snapshot";

describe("summarizeAppStorageDroppedRecords", () => {
  it("returns no message when nothing was dropped", () => {
    const result = summarizeAppStorageDroppedRecords({});
    expect(result.total).toBe(0);
    expect(result.message).toBe("");
  });

  it("ignores zero-count entries", () => {
    const result = summarizeAppStorageDroppedRecords({
      characters: 0,
      lorebooks: 0,
    });
    expect(result.total).toBe(0);
    expect(result.message).toBe("");
  });

  it("totals drops across collections and names each collection in the warning", () => {
    const result = summarizeAppStorageDroppedRecords({
      characters: 2,
      messengerMessages: 1,
    });

    expect(result.total).toBe(3);
    expect(result.message).toContain("3 unreadable record(s)");
    expect(result.message).toContain("Characters (2)");
    expect(result.message).toContain("Messenger messages (1)");
    // The warning must tell the user that saving erases the skipped records.
    expect(result.message.toLowerCase()).toContain("erase");
  });

  it("covers every collection key so labels never go missing", () => {
    // Every collection key should be accepted and surfaced when it has drops.
    for (const collectionKey of APP_STORAGE_COLLECTION_KEYS) {
      const result = summarizeAppStorageDroppedRecords({ [collectionKey]: 1 });
      expect(result.total).toBe(1);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
