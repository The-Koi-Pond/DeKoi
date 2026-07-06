import { beforeEach, describe, expect, it, vi } from "vitest";

import { invokeRemote } from "../../shared/api/remote-runtime";
import { RUNTIME_COMMANDS } from "../../shared/api/runtime-commands";
import { STORAGE_ENTITIES } from "./storage-entities";
import { createStorageRepository } from "./storage-repository-factory";
import type { StorageRecord } from "./storage-repository";

vi.mock("../../shared/api/remote-runtime", () => ({
  invokeRemote: vi.fn(),
}));

type TestRecord = StorageRecord & {
  label: string;
};

function normalizeTestRecord(value: unknown): TestRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.label === "string"
    ? { id: candidate.id, label: candidate.label }
    : null;
}

describe("createStorageRepository", () => {
  beforeEach(() => {
    vi.mocked(invokeRemote).mockReset();
  });

  it("counts raw records rejected by the normalizer in load snapshots", async () => {
    vi.mocked(invokeRemote).mockResolvedValue([
      { id: "record-1", label: "kept" },
      { id: "record-2" },
      null,
    ]);

    const repository = createStorageRepository<TestRecord>({
      entity: STORAGE_ENTITIES.characters,
      normalizeRecord: normalizeTestRecord,
      seedRecords: [],
    });

    const snapshot = await repository.loadSnapshot("http://runtime.test");

    expect(snapshot.records).toEqual([{ id: "record-1", label: "kept" }]);
    expect(snapshot.droppedRecordCount).toBe(2);
    expect(snapshot.status).toBe("ready");
    expect(snapshot.message).toBe("Remote runtime storage is active.");
    expect(invokeRemote).toHaveBeenCalledWith(
      RUNTIME_COMMANDS.storageList,
      {
        entity: STORAGE_ENTITIES.characters,
        options: null,
      },
      "http://runtime.test",
    );
  });

  it("does not replace a successful empty load with seed records", async () => {
    vi.mocked(invokeRemote).mockResolvedValue([]);

    const repository = createStorageRepository<TestRecord>({
      entity: STORAGE_ENTITIES.characters,
      normalizeRecord: normalizeTestRecord,
      seedRecords: [{ id: "seed-1", label: "starter" }],
    });

    const snapshot = await repository.loadSnapshot("http://runtime.test");

    expect(snapshot.records).toEqual([]);
    expect(snapshot.droppedRecordCount).toBe(0);
    expect(snapshot.status).toBe("ready");
  });

  it("treats non-array storage_list responses as load errors", async () => {
    vi.mocked(invokeRemote).mockResolvedValue("not-records");

    const repository = createStorageRepository<TestRecord>({
      entity: STORAGE_ENTITIES.characters,
      normalizeRecord: normalizeTestRecord,
      seedRecords: [],
    });

    const snapshot = await repository.loadSnapshot("http://runtime.test");

    expect(snapshot.records).toEqual([]);
    expect(snapshot.droppedRecordCount).toBe(0);
    expect(snapshot.status).toBe("error");
    expect(snapshot.message).toContain("non-array response");
  });
});
