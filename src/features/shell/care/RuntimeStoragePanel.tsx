import type { FormEventHandler } from "react";
import type { DeKoiDesktopHostStatus } from "../../../shared/api/desktop-host-status";
import type {
  AppStorageCollectionKey,
  AppStorageRepairCollectionStatus,
  AppStorageRepairStatusResult,
  AppStorageRepairStrategy,
  StorageMode,
  AppStorageSyncStatus,
} from "../../runtime";
import type { StorageRepairActionState } from "./care-drawer-types";
import { StorageRepairList } from "./StorageRepairList";

interface RuntimeStoragePanelProps {
  runtimeUrl: string;
  runtimeStatusMessage: string;
  appStorageMode: StorageMode;
  appStorageStatus: AppStorageSyncStatus;
  desktopHostStatus: DeKoiDesktopHostStatus | null;
  desktopHostBusy: boolean;
  storageReloadBusy: boolean;
  storageHasUnsavedChanges: boolean;
  droppedRecordsSummary: { total: number; message: string };
  storageLoadErrors: { collectionKey: AppStorageCollectionKey; label: string; message: string }[];
  storageReloadStatus: string;
  storageRepairStatus: AppStorageRepairStatusResult | null;
  storageActionBusy: boolean;
  storageRepairBusy: StorageRepairActionState | null;
  storageRepairConfirmation: StorageRepairActionState | null;
  onRuntimeSubmit: FormEventHandler<HTMLFormElement>;
  onRuntimeUrlChange: (runtimeUrl: string) => void;
  onRuntimeTest: () => void;
  onUseLocalStorage: () => void;
  onUseDesktopRuntime: () => void;
  onDesktopHostCheck: () => void;
  onStorageStaleCheck: () => void;
  onStorageReload: () => void;
  onStorageRepair: (
    collection: AppStorageRepairCollectionStatus,
    strategy: AppStorageRepairStrategy,
  ) => void;
  onStorageRepairFinish: (collection: AppStorageRepairCollectionStatus) => void;
}

export function RuntimeStoragePanel({
  runtimeUrl,
  runtimeStatusMessage,
  appStorageMode,
  appStorageStatus,
  desktopHostStatus,
  desktopHostBusy,
  storageReloadBusy,
  storageHasUnsavedChanges,
  droppedRecordsSummary,
  storageLoadErrors,
  storageReloadStatus,
  storageRepairStatus,
  storageActionBusy,
  storageRepairBusy,
  storageRepairConfirmation,
  onRuntimeSubmit,
  onRuntimeUrlChange,
  onRuntimeTest,
  onUseLocalStorage,
  onUseDesktopRuntime,
  onDesktopHostCheck,
  onStorageStaleCheck,
  onStorageReload,
  onStorageRepair,
  onStorageRepairFinish,
}: RuntimeStoragePanelProps) {
  return (
    <>
      <form className="runtime-panel" onSubmit={onRuntimeSubmit}>
        <div className="field">
          <label htmlFor="remote-runtime-url">Remote Runtime URL</label>
          <input
            className="pondinput"
            id="remote-runtime-url"
            type="url"
            placeholder="http://127.0.0.1:7341 or desktop://runtime"
            value={runtimeUrl}
            onChange={(event) => onRuntimeUrlChange(event.target.value)}
          />
          <div className="help">
            Later profile and save-data sync will use this host. Leave empty for desktop host
            storage inside Tauri.
          </div>
        </div>

        <div className={`runtime-status ${appStorageStatus}`}>
          <b>
            {appStorageMode === "remote"
              ? "Remote runtime"
              : appStorageMode === "desktop"
                ? "Desktop host"
                : "Storage unavailable"}
          </b>
          <span>{runtimeStatusMessage}</span>
        </div>

        <div className="runtime-status">
          <b>{desktopHostStatus?.hostKind === "tauri" ? "Desktop host" : "Browser host"}</b>
          <span>
            {desktopHostStatus?.message ?? "Check whether native host capabilities are available."}
          </span>
        </div>

        {desktopHostStatus && (
          <div className="host-flags" aria-label="Desktop host readiness">
            <span className={desktopHostStatus.storageReady ? "on" : ""}>Storage</span>
            <span className={desktopHostStatus.runtimeReady ? "on" : ""}>Runtime</span>
          </div>
        )}

        <div className="runtime-actions">
          <button type="submit" className="care-btn primary">
            Apply
          </button>
          <button type="button" onClick={onRuntimeTest}>
            Test
          </button>
          <button type="button" onClick={onUseLocalStorage}>
            Use host default
          </button>
          <button type="button" onClick={onUseDesktopRuntime}>
            Use desktop
          </button>
          <button type="button" disabled={desktopHostBusy} onClick={onDesktopHostCheck}>
            {desktopHostBusy ? "Checking host" : "Check host"}
          </button>
        </div>
      </form>

      <section className="bundle-section" aria-labelledby="storage-reload">
        <div className="catalog-section-head">
          <div>
            <h3 id="storage-reload">Stored collections</h3>
            <span>reload on demand</span>
          </div>
        </div>

        <div className="runtime-actions">
          <button type="button" disabled={storageReloadBusy} onClick={onStorageStaleCheck}>
            {storageReloadBusy ? "Checking files" : "Check files"}
          </button>
          <button
            type="button"
            className="care-btn primary"
            disabled={storageReloadBusy}
            onClick={onStorageReload}
          >
            {storageReloadBusy ? "Reloading records" : "Reload records"}
          </button>
        </div>

        {storageHasUnsavedChanges && (
          <p className="bundle-note">Storage has local changes or pending saves.</p>
        )}
        {droppedRecordsSummary.total > 0 && (
          <p className="bundle-status storage-dropped-warning" role="alert">
            {droppedRecordsSummary.message}
          </p>
        )}
        {storageLoadErrors.length > 0 && (
          <div className="bundle-status storage-load-errors" role="alert">
            <b>Collection load errors</b>
            <ul>
              {storageLoadErrors.map(({ collectionKey, label, message }) => (
                <li key={collectionKey}>
                  <b>{label}:</b> {message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {storageReloadStatus && <p className="bundle-status">{storageReloadStatus}</p>}
        {storageRepairStatus && (
          <StorageRepairList
            collections={storageRepairStatus.collections}
            storageActionBusy={storageActionBusy}
            storageRepairBusy={storageRepairBusy}
            storageRepairConfirmation={storageRepairConfirmation}
            onStorageRepair={onStorageRepair}
            onStorageRepairFinish={onStorageRepairFinish}
          />
        )}
      </section>
    </>
  );
}
