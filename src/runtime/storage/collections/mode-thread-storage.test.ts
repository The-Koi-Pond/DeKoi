import { describe, expect, it } from "vitest";

import { createModeMessage } from "../../../engine/modes/mode-thread/mode-thread-actions";
import { createMessengerThread } from "../../../engine/modes/messenger/messenger-actions";
import { toModeThreadStorageRecord } from "../app-storage-collection-projection";
import { normalizeModeMessageRecord } from "./mode-message-storage";
import { normalizeModeThreadRecord } from "./mode-thread-storage";

const now = "2026-07-14T00:00:00.000Z";

function createThread() {
  return createMessengerThread({
    id: "thread-1",
    branchId: "branch-1",
    title: "Thread",
    characterIds: ["character-1"],
    activePersonaId: "persona-1",
    now,
  });
}

describe("mode-thread storage normalization", () => {
  it("accepts canonical thread metadata without embedding messages", () => {
    const thread = createThread();

    expect(normalizeModeThreadRecord(toModeThreadStorageRecord(thread))).toEqual(
      toModeThreadStorageRecord(thread),
    );
  });

  it("rejects embedded transcripts and mismatched branch ownership", () => {
    const thread = createThread();
    const metadata = toModeThreadStorageRecord(thread);

    expect(normalizeModeThreadRecord({ ...metadata, messages: [] })).toBeNull();
    expect(
      normalizeModeThreadRecord({
        ...metadata,
        branches: [{ ...metadata.branches[0], threadId: "another-thread" }],
      }),
    ).toBeNull();
    expect(
      normalizeModeThreadRecord({
        ...metadata,
        branches: [{ ...metadata.branches[0], kind: "roleplay" }],
      }),
    ).toBeNull();
  });

  it("rejects obsolete system prompt fields on branches", () => {
    const metadata = toModeThreadStorageRecord(createThread());

    expect(
      normalizeModeThreadRecord({
        ...metadata,
        branches: [{ ...metadata.branches[0], systemPromptMode: "custom" }],
      }),
    ).toBeNull();
    expect(
      normalizeModeThreadRecord({
        ...metadata,
        branches: [{ ...metadata.branches[0], systemPrompt: "Prompt" }],
      }),
    ).toBeNull();
  });

  it("rejects malformed branch values without throwing", () => {
    const metadata = toModeThreadStorageRecord(createThread());

    expect(() => normalizeModeThreadRecord({ ...metadata, branches: [null] })).not.toThrow();
    expect(normalizeModeThreadRecord({ ...metadata, branches: [null] })).toBeNull();
  });
});

describe("mode-message storage normalization", () => {
  it("rejects the removed narrator author kind", () => {
    const narration = {
      ...createModeMessage({
        id: "scene-1",
        versionId: "version-1",
        threadId: "thread-1",
        branchId: "branch-1",
        author: { kind: "system", label: "Scene" },
        body: "The room goes quiet.",
        origin: "manual",
        now,
      }),
      author: { kind: "narrator", label: "Narrator" },
    };

    expect(normalizeModeMessageRecord(narration)).toBeNull();
  });

  it("preserves every version and the active version reference", () => {
    const first = createModeMessage({
      id: "message-1",
      versionId: "version-1",
      threadId: "thread-1",
      branchId: "branch-1",
      author: { kind: "persona", personaId: "persona-1", label: "Me" },
      body: "First",
      origin: "manual",
      now,
    });
    const message = {
      ...first,
      activeVersionId: "version-2",
      versions: [...first.versions, { ...first.versions[0], id: "version-2", body: "Second" }],
    };

    expect(normalizeModeMessageRecord(message)).toEqual(message);
  });

  it("rejects messages without valid ownership or active versions", () => {
    const message = createModeMessage({
      id: "message-1",
      versionId: "version-1",
      threadId: "thread-1",
      branchId: "branch-1",
      author: { kind: "system", label: "System" },
      body: "Text",
      origin: "imported",
      now,
    });

    expect(normalizeModeMessageRecord({ ...message, branchId: "" })).toBeNull();
    expect(normalizeModeMessageRecord({ ...message, activeVersionId: "missing" })).toBeNull();
  });
});
