import type { AppStorageRepairCollectionStatus, AppStorageRepairStrategy } from "../../runtime";
import type {
  StorageRepairActionState,
  StorageRepairConfirmationAction,
} from "./care-drawer-types";

interface StorageRepairListProps {
  collections: AppStorageRepairCollectionStatus[];
  storageActionBusy: boolean;
  storageRepairBusy: StorageRepairActionState | null;
  storageRepairConfirmation: StorageRepairActionState | null;
  onStorageRepair: (
    collection: AppStorageRepairCollectionStatus,
    strategy: AppStorageRepairStrategy,
  ) => void;
  onStorageRepairFinish: (collection: AppStorageRepairCollectionStatus) => void;
}

export function StorageRepairList({
  collections,
  storageActionBusy,
  storageRepairBusy,
  storageRepairConfirmation,
  onStorageRepair,
  onStorageRepairFinish,
}: StorageRepairListProps) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <div className="storage-repair-list" aria-live="polite">
      {collections.map((collection) => {
        const restoreConfirmed = storageRepairConfirmationMatches(
          storageRepairConfirmation,
          collection,
          "restore-backup",
        );
        const replaceConfirmed = storageRepairConfirmationMatches(
          storageRepairConfirmation,
          collection,
          "replace-empty",
        );
        const finishConfirmed = storageRepairConfirmationMatches(
          storageRepairConfirmation,
          collection,
          "finish-repair",
        );
        const busyForCollection = storageRepairBusy?.entity === collection.entity;

        return (
          <article
            className={`storage-repair-row${collection.error ? " error" : ""}`}
            key={collection.entity}
          >
            <div className="storage-repair-copy">
              <b>{collection.label}</b>
              <span>{collection.error ?? "Pre-repair copy is saved."}</span>
              <div
                className="storage-repair-flags"
                aria-label={`${collection.label} recovery artifacts`}
              >
                <span className={collection.backupExists ? "on" : ""}>Backup</span>
                <span className={collection.preRepairExists ? "on" : ""}>Pre-repair</span>
                {collection.temporaryExists && <span className="on">Temp</span>}
              </div>
            </div>

            <div className="runtime-actions storage-repair-actions">
              {collection.known && collection.repairable && (
                <>
                  <button
                    type="button"
                    disabled={storageActionBusy || !collection.canRestoreBackup}
                    onClick={() => onStorageRepair(collection, "restore-backup")}
                  >
                    {restoreConfirmed ? "Confirm restore" : "Restore backup"}
                  </button>
                  {!collection.canRestoreBackup && (
                    <button
                      type="button"
                      className="care-btn danger"
                      disabled={storageActionBusy}
                      onClick={() => onStorageRepair(collection, "replace-empty")}
                    >
                      {replaceConfirmed ? "Confirm empty" : "Replace empty"}
                    </button>
                  )}
                </>
              )}

              {collection.known && collection.canFinishRepair && (
                <button
                  type="button"
                  className="care-btn primary"
                  disabled={storageActionBusy}
                  onClick={() => onStorageRepairFinish(collection)}
                >
                  {finishConfirmed ? "Confirm finish" : "Finish repair"}
                </button>
              )}
            </div>

            {busyForCollection && <p className="bundle-note">Working on {collection.label}...</p>}
            {!collection.known && (
              <p className="bundle-note">
                Update DeKoi before repairing this collection in the app.
              </p>
            )}
            {collection.known && collection.repairable && !collection.canRestoreBackup && (
              <p className="bundle-note">
                {collection.backupExists
                  ? "Backup file exists but cannot be restored."
                  : "No backup file is available for restore."}
              </p>
            )}
            {collection.known && collection.repairable && collection.canRestoreBackup && (
              <p className="bundle-note">
                Backup restore is available. Empty replacement is hidden.
              </p>
            )}
            {collection.temporaryExists && (
              <p className="bundle-note">
                Temp is a leftover write scratch file. Repair works from the live file and backup.
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function storageRepairConfirmationMatches(
  storageRepairConfirmation: StorageRepairActionState | null,
  collection: AppStorageRepairCollectionStatus,
  action: StorageRepairConfirmationAction,
) {
  return (
    storageRepairConfirmation?.entity === collection.entity &&
    storageRepairConfirmation.action === action
  );
}
