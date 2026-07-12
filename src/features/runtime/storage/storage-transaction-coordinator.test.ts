import { describe, expect, it } from "vitest";

import type { AppStorageRecords } from "./app-storage-workflows";
import { createStorageTransactionCoordinator } from "./storage-transaction-coordinator";

function records(label: string): AppStorageRecords {
  return {
    appSettings: { label } as unknown as AppStorageRecords["appSettings"],
    characters: [],
    personas: [],
    lorebooks: [],
    promptPresets: [],
    loreRuntimeStates: [],
    macroVariableStates: [],
    providerConnections: [],
    roleplayThreads: [],
    messengerThreads: [],
    rippleStates: [],
  };
}

const target = { generation: 4, rawUrl: "http://runtime-a.test" };

describe("storage transaction coordinator", () => {
  it("rejects overlapping prompt, bundle, and restore transactions", () => {
    const coordinator = createStorageTransactionCoordinator(target, records("initial"));
    const bundle = coordinator.tryBegin("bundle-import");

    expect(bundle).not.toBeNull();
    expect(coordinator.hasActiveTransaction()).toBe(true);
    expect(coordinator.tryBegin("prompt-preset-import")).toBeNull();
    expect(coordinator.tryBegin("pre-import-backup-restore")).toBeNull();
  });

  it("captures an immutable target identity", () => {
    const mutableTarget = { ...target };
    const coordinator = createStorageTransactionCoordinator(mutableTarget, records("initial"));
    const transaction = coordinator.tryBegin("prompt-preset-import")!;

    mutableTarget.rawUrl = "http://mutated.test";

    expect(transaction.target).toEqual(target);
    expect(Object.isFrozen(transaction.target)).toBe(true);
  });

  it("updates latest and rollback state for the captured target", () => {
    const initial = records("initial");
    const edited = records("edited");
    const coordinator = createStorageTransactionCoordinator(target, initial);
    const transaction = coordinator.tryBegin("prompt-preset-import")!;

    coordinator.publishCurrentState(target, edited);

    expect(transaction.getLatestSnapshot()).toBe(edited);
    expect(transaction.getRollbackSnapshot()).toBe(edited);
  });

  it("does not replace rollback state with state from a new target", () => {
    const originalTargetEdit = records("original target edit");
    const newTargetState = records("new target");
    const coordinator = createStorageTransactionCoordinator(target, records("initial"));
    const transaction = coordinator.tryBegin("prompt-preset-import")!;

    coordinator.publishCurrentState(target, originalTargetEdit);
    coordinator.publishCurrentState(
      { generation: 5, rawUrl: "http://runtime-b.test" },
      newTargetState,
    );

    expect(transaction.getLatestSnapshot()).toBe(originalTargetEdit);
    expect(transaction.getRollbackSnapshot()).toBe(originalTargetEdit);
  });

  it("reports a generation or URL target change", () => {
    const coordinator = createStorageTransactionCoordinator(target, records("initial"));
    const transaction = coordinator.tryBegin("prompt-preset-import")!;

    expect(transaction.isTargetCurrent()).toBe(true);
    coordinator.publishCurrentState({ ...target, generation: 5 }, records("generation change"));
    expect(transaction.isTargetCurrent()).toBe(false);
    transaction.finish();

    const urlTransaction = coordinator.tryBegin("prompt-preset-import")!;
    coordinator.publishCurrentState({ ...target, rawUrl: "http://runtime-b.test" }, records("b"));
    expect(urlTransaction.isTargetCurrent()).toBe(false);
  });

  it("makes finish idempotent and prevents a stale finish from releasing new work", () => {
    const coordinator = createStorageTransactionCoordinator(target, records("initial"));
    const first = coordinator.tryBegin("prompt-preset-import")!;

    expect(first.finish()).toBe(true);
    const restore = coordinator.tryBegin("pre-import-backup-restore")!;
    expect(first.finish()).toBe(false);
    expect(coordinator.hasActiveTransaction()).toBe(true);
    expect(coordinator.tryBegin("bundle-import")).toBeNull();
    expect(restore.finish()).toBe(true);
    expect(coordinator.hasActiveTransaction()).toBe(false);
  });
});
