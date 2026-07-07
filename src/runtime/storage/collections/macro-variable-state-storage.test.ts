import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "../../../shared/api/remote-runtime";
import { RUNTIME_COMMANDS } from "../../../shared/api/runtime-commands";
import { STORAGE_ENTITIES } from "../storage-entities";
import {
  normalizeMacroVariableScope,
  saveMacroVariableStatesToStorage,
} from "./macro-variable-state-storage";

vi.mock("../../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
}));

const now = "2026-07-06T00:00:00.000Z";

describe("normalizeMacroVariableScope", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("normalizes owner scope variables to string values with trimmed names", () => {
    const record = normalizeMacroVariableScope({
      id: "macro-variable-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      variables: {
        " mood ": "calm",
        count: 3,
        blank: null,
        " ": "dropped",
      },
      createdAt: now,
      updatedAt: now,
    });

    expect(record).toEqual({
      id: "macro-variable-state-under-test",
      schemaVersion: 1,
      ownerKind: "messenger-thread",
      ownerId: "messenger-thread-1",
      variables: {
        mood: "calm",
        count: "",
        blank: "",
      },
      createdAt: now,
      updatedAt: now,
    });
  });

  it("canonicalizes global owner ID and rejects malformed owner/schema values", () => {
    expect(
      normalizeMacroVariableScope({
        id: "macro-variable-state-global",
        schemaVersion: 1,
        ownerKind: "global",
        ownerId: "hand-edited-global",
        variables: {},
      }),
    ).toEqual(expect.objectContaining({ ownerKind: "global", ownerId: "global" }));
    expect(
      normalizeMacroVariableScope({
        id: "state",
        schemaVersion: 2,
        ownerKind: "messenger-thread",
        ownerId: "thread",
      }),
    ).toBeNull();
    expect(
      normalizeMacroVariableScope({
        id: "state",
        schemaVersion: 1,
        ownerKind: "unknown",
        ownerId: "thread",
      }),
    ).toBeNull();
  });

  it("passes storage metadata through save results", async () => {
    const metadata = {
      entity: STORAGE_ENTITIES.macroVariableStates,
      exists: true,
      byteLength: 128,
      updatedAtMs: 1760000000000,
      contentHash: "macro-variable-state-hash",
    };
    vi.mocked(invokeRemote).mockResolvedValue({ ok: true, count: 1, metadata });

    const result = await saveMacroVariableStatesToStorage(
      [
        {
          id: "macro-variable-state-global",
          schemaVersion: 1,
          ownerKind: "global",
          ownerId: "global",
          variables: { mood: "calm" },
          createdAt: now,
          updatedAt: now,
        },
      ],
      "http://runtime.test",
    );

    expect(result.metadata).toEqual(metadata);
    expect(invokeRemote).toHaveBeenCalledWith(
      RUNTIME_COMMANDS.storageReplace,
      {
        entity: STORAGE_ENTITIES.macroVariableStates,
        records: [
          {
            id: "macro-variable-state-global",
            schemaVersion: 1,
            ownerKind: "global",
            ownerId: "global",
            variables: { mood: "calm" },
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
      "http://runtime.test",
    );
  });
});
