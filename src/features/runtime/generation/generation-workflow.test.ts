import { describe, expect, it, vi } from "vitest";

import { createCharacterRecord } from "../../../engine/catalog/character-actions";
import type { LoreRuntimeState } from "../../../engine/contracts/types/lore-runtime-state";
import type {
  GenerationRequestBase,
  GenerationResponse,
} from "../../../engine/generation/generation";
import { runGenerationWorkflow } from "./generation-workflow";

const now = "2026-07-14T00:00:00.000Z";

type TestThread = { id: string; activeBranchId: string };
type TestContext = { companions: ReturnType<typeof createCharacterRecord>[] };
type TestRequest = GenerationRequestBase;
type TestRecord = { id: string; branchId: string };

function response(): GenerationResponse {
  return {
    schemaVersion: 1,
    requestId: "request-1",
    source: "provider-transport",
    createdAt: now,
    messages: [{ characterId: "companion-1", body: "Generated." }],
    warnings: [],
  };
}

function runtimeState(ownerId: string): LoreRuntimeState {
  return {
    id: "lore-state-1",
    schemaVersion: 1,
    ownerKind: "mode-branch",
    ownerId,
    lastEvaluatedMessageCount: 1,
    entries: [
      {
        lorebookId: "lorebook-1",
        entryId: "entry-1",
        entryUpdatedAt: now,
        activatedAtMessageIndex: 1,
        stickyRemaining: 1,
        cooldownRemaining: 0,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function input(
  overrides: Partial<
    Parameters<
      typeof runGenerationWorkflow<
        TestThread,
        TestContext,
        TestRequest,
        GenerationResponse,
        TestRecord
      >
    >[0]
  > = {},
) {
  const thread = { id: "thread-1", activeBranchId: "branch-captured" };
  const companion = createCharacterRecord({
    id: "companion-1",
    input: { displayName: "Mara" },
    now,
  });
  return {
    appendRecords: vi.fn((target: TestThread, records: TestRecord[], branchId: string) => ({
      ...target,
      appended: records.length,
      branchId,
    })),
    createContext: () => ({ companions: [companion] }),
    createId: (prefix: string) => `${prefix}-1`,
    createRecord: ({ id }: { id: string }) => ({ id, branchId: thread.activeBranchId }),
    createRequestAssembly: ({ loreRuntimeState }: { loreRuntimeState: LoreRuntimeState }) => ({
      request: {
        id: "request-1",
        createdAt: now,
        providerConnection: null,
        targetCharacterId: "companion-1",
        targetCharacterName: "Mara",
        promptMessages: [],
        parameters: { temperature: 1, maxTokens: 1, topP: 1 },
        warnings: [],
      },
      loreRuntimeState,
      macroVariableMutations: [],
    }),
    generateResponse: async () => response(),
    macroVariableStates: [],
    now,
    ownerKind: "mode-branch" as const,
    recordIdPrefix: "record",
    versionIdPrefix: "version",
    requestIdPrefix: "request",
    thread,
    ...overrides,
  };
}

describe("runGenerationWorkflow branch ownership", () => {
  it("captures the active branch for lore, macro commits, and appends", async () => {
    const requestAssembly = vi.fn(input().createRequestAssembly);
    const result = await runGenerationWorkflow({
      ...input({ existingLoreRuntimeState: runtimeState("branch-captured") }),
      createRequestAssembly: requestAssembly,
    });

    expect(requestAssembly.mock.calls[0][0].loreRuntimeState.ownerId).toBe("branch-captured");
    expect(result.loreRuntimeState?.ownerId).toBe("branch-captured");
    expect(result.macroVariableCommit.ownerId).toBe("branch-captured");
    expect(result.thread).toMatchObject({ branchId: "branch-captured" });
  });

  it("rejects existing lore state owned by another branch", async () => {
    await expect(
      runGenerationWorkflow(input({ existingLoreRuntimeState: runtimeState("branch-other") })),
    ).rejects.toThrow("Existing lore runtime state belongs to a different generation owner.");
  });
});
