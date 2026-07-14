import type { AppStorageRecords } from "./app-storage-workflows";

type StorageTransactionKind =
  | "prompt-preset-import"
  | "prompt-preset-catalog-save"
  | "prompt-preset-relationship"
  | "bundle-import"
  | "pre-import-backup-restore";

export type StorageTransactionTarget = Readonly<{
  generation: number;
  rawUrl: string;
}>;

interface StorageTransaction {
  readonly kind: StorageTransactionKind;
  readonly target: StorageTransactionTarget;
  getLatestSnapshot: () => AppStorageRecords;
  getRollbackSnapshot: () => AppStorageRecords;
  isTargetCurrent: () => boolean;
  finish: () => boolean;
}

export interface StorageTransactionCoordinator {
  publishCurrentState: (target: StorageTransactionTarget, snapshot: AppStorageRecords) => void;
  tryBegin: (kind: StorageTransactionKind) => StorageTransaction | null;
  hasActiveTransaction: () => boolean;
}

function sameTarget(left: StorageTransactionTarget, right: StorageTransactionTarget) {
  return left.generation === right.generation && left.rawUrl === right.rawUrl;
}

export function createStorageTransactionCoordinator(
  initialTarget: StorageTransactionTarget,
  initialSnapshot: AppStorageRecords,
): StorageTransactionCoordinator {
  let currentTarget = Object.freeze({ ...initialTarget });
  let currentSnapshot = initialSnapshot;
  let activeTransaction: object | null = null;
  let publishActiveSnapshot: ((snapshot: AppStorageRecords) => void) | null = null;

  return {
    publishCurrentState(target, snapshot) {
      currentTarget = Object.freeze({ ...target });
      currentSnapshot = snapshot;
      publishActiveSnapshot?.(snapshot);
    },

    tryBegin(kind) {
      if (activeTransaction) return null;

      const identity = {};
      const target = Object.freeze({ ...currentTarget });
      let latestSnapshot = currentSnapshot;
      let rollbackSnapshot = currentSnapshot;
      let finished = false;

      activeTransaction = identity;
      publishActiveSnapshot = (snapshot) => {
        if (!sameTarget(currentTarget, target)) return;
        latestSnapshot = snapshot;
        rollbackSnapshot = snapshot;
      };

      return {
        kind,
        target,
        getLatestSnapshot: () => latestSnapshot,
        getRollbackSnapshot: () => rollbackSnapshot,
        isTargetCurrent: () => sameTarget(currentTarget, target),
        finish: () => {
          if (finished || activeTransaction !== identity) return false;
          finished = true;
          activeTransaction = null;
          publishActiveSnapshot = null;
          return true;
        },
      };
    },

    hasActiveTransaction: () => activeTransaction !== null,
  };
}
