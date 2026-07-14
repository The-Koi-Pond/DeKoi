import { describe, expect, it } from "vitest";
import { toModeThreadStorageRecord } from "../app-storage-collection-projection";
import { normalizeModeThreadRecord } from "../collections/mode-thread-storage";
import { normalizeLegacyImport } from "./legacy-import";
const now = "2026-06-24T07:00:00.000Z";

describe("legacy Messenger import", () => {
  it("produces canonical single-branch threads and single-version messages", () => {
    const result = normalizeLegacyImport({
      messengerThreads: [
        {
          id: "legacy-thread",
          kind: "messenger",
          title: "Legacy",
          characterIds: [],
          messages: [
            {
              id: "legacy-message",
              body: "Hello",
              author: { kind: "narrator", label: "Narrator" },
              createdAt: now,
              updatedAt: now,
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const thread = result.preview.data.modeThreads[0];
    const message = result.preview.data.modeThreads[0]?.messages[0];
    expect(thread?.branches).toHaveLength(1);
    expect(thread?.activeBranchId).toBe(`${thread?.id}-branch-1`);
    expect(thread?.branches[0]).toMatchObject({
      systemPromptMode: "default",
      systemPrompt: "",
    });
    expect(thread && normalizeModeThreadRecord(toModeThreadStorageRecord(thread))).not.toBeNull();
    expect(message?.threadId).toBe(thread?.id);
    expect(message?.branchId).toBe(thread?.branches[0]?.id);
    expect(message?.versions).toHaveLength(1);
    expect(message?.activeVersionId).toBe(message?.versions[0]?.id);
    expect(message?.author).toEqual({ kind: "system", label: "System" });
    expect(result.preview.counts).toMatchObject({ messengerThreads: 1, messengerMessages: 1 });
  });
  it("keeps mode-branch owner IDs aligned for imported thread variables", () => {
    const result = normalizeLegacyImport({
      messengerThreads: [
        {
          id: "legacy-vars",
          kind: "messenger",
          title: "Legacy",
          variables: { mood: "happy" },
          messages: [],
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const thread = result.preview.data.modeThreads[0];
    const state = result.preview.data.messengerThreadMacroVariableStates[0];
    expect(state?.ownerKind).toBe("mode-branch");
    expect(state?.ownerId).toBe(thread?.branches[0]?.id);
  });
  it("imports global variables and reports unsupported empty input", () => {
    const result = normalizeLegacyImport({ globalVariables: { weather: "rain" } });
    expect(result.ok && result.preview.data.macroVariableStates[0]?.ownerId).toBe("global");
    expect(normalizeLegacyImport({}).ok).toBe(false);
  });
});
