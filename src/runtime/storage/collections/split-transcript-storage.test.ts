import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "../../../shared/api/remote-runtime";
import { loadMessengerThreadsFromStorage } from "./messenger-storage";
import { loadRoleplayThreadsFromStorage } from "./roleplay-storage";

vi.mock("../../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
}));

const createdAt = "2026-01-01T00:00:00.000Z";
const updatedAt = "2026-01-01T00:01:00.000Z";

describe("split transcript storage", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("counts invalid legacy embedded Messenger messages during load", async () => {
    vi.mocked(invokeRemote).mockResolvedValue([
      {
        id: "bubble-thread-1",
        schemaVersion: 1,
        kind: "bubbles",
        title: "New Bubble",
        messages: [
          {
            id: "bubble-message-1",
            author: { kind: "user" },
            body: "kept",
            origin: "manual",
            createdAt,
            updatedAt,
          },
          {
            id: "bubble-message-2",
            body: "missing author",
            origin: "manual",
            createdAt,
            updatedAt,
          },
        ],
      },
    ]);

    const snapshot = await loadMessengerThreadsFromStorage("http://runtime.test");

    expect(snapshot.droppedRecordCount).toBe(1);
    expect(snapshot.hasLegacyEmbeddedMessages).toBe(true);
    expect(snapshot.threads[0]?.messages).toHaveLength(1);
  });

  it("counts invalid legacy embedded Roleplay entries during load", async () => {
    vi.mocked(invokeRemote).mockResolvedValue([
      {
        id: "roleplay-thread-1",
        schemaVersion: 1,
        title: "Scene",
        entries: [
          {
            id: "roleplay-entry-1",
            body: "kept",
            createdAt,
            updatedAt,
          },
          {
            id: "roleplay-entry-2",
            body: "",
            createdAt,
            updatedAt,
          },
        ],
      },
    ]);

    const snapshot = await loadRoleplayThreadsFromStorage("http://runtime.test");

    expect(snapshot.droppedRecordCount).toBe(1);
    expect(snapshot.hasLegacyEmbeddedEntries).toBe(true);
    expect(snapshot.records[0]?.entries).toHaveLength(1);
  });
});
