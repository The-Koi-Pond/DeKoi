import type { StorageImportFailureSource } from "./care-drawer-types";

interface StorageImportFailureActionsProps {
  source: StorageImportFailureSource;
  restoreAvailable: boolean;
  backupPath?: string | null;
  restoreBusy: boolean;
  restoreConfirmed: boolean;
  onRestore: () => void;
  onAcknowledge: () => void;
}

export function StorageImportFailureActions({
  source,
  restoreAvailable,
  backupPath,
  restoreBusy,
  restoreConfirmed,
  onRestore,
  onAcknowledge,
}: StorageImportFailureActionsProps) {
  const fallback = backupPath
    ? `Saved backup file: ${backupPath}.`
    : "Manual fallback: import the pre-import backup bundle file you saved.";

  return (
    <>
      <p className="bundle-note">{fallback}</p>
      <div className="runtime-actions">
        {restoreAvailable && (
          <button
            type="button"
            className="care-btn primary"
            disabled={restoreBusy}
            onClick={onRestore}
          >
            {restoreBusy
              ? "Restoring backup"
              : restoreConfirmed
                ? "Confirm restore"
                : "Restore pre-import backup"}
          </button>
        )}
        <button type="button" onClick={onAcknowledge}>
          Acknowledge {source === "legacy" ? "legacy " : ""}import failure
        </button>
      </div>
    </>
  );
}
