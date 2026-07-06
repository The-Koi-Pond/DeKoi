import type { ChangeEventHandler } from "react";
import type {
  DeKoiLegacyImportPreview,
  DeKoiStorageBundleCounts,
  DeKoiStorageBundlePreview,
} from "../../runtime";
import type { StorageImportFailureSource } from "./care-drawer-types";
import { BundleCounts, BundleImportPreview, LegacyImportPreview } from "./ImportPreviewSections";
import { StorageImportFailureActions } from "./StorageImportFailureActions";

interface ImportFailureRecoveryProps {
  source: StorageImportFailureSource | null;
  restoreAvailable: boolean;
  backupPath?: string | null;
  restoreBusy: boolean;
  restoreConfirmed: boolean;
  onRestore: () => void;
  onAcknowledge: () => void;
}

interface StockingToolsPanelProps {
  currentBundleCounts: DeKoiStorageBundleCounts;
  desktopFileBusy: boolean;
  bundlePreview: DeKoiStorageBundlePreview | null;
  bundleReplaceConfirmed: boolean;
  bundleStatus: string;
  bundleImportBusy: boolean;
  legacyPreview: DeKoiLegacyImportPreview | null;
  legacyImportConfirmed: boolean;
  legacyStatus: string;
  legacyImportBusy: boolean;
  importFailureRecovery: ImportFailureRecoveryProps;
  onBundleExport: () => void;
  onDesktopBundleExport: () => void;
  onBundleFileChange: ChangeEventHandler<HTMLInputElement>;
  onDesktopBundleFileImport: () => void;
  onBundleReplaceConfirmedChange: (confirmed: boolean) => void;
  onBundleImport: () => void;
  onLegacyFileChange: ChangeEventHandler<HTMLInputElement>;
  onLegacyImportConfirmedChange: (confirmed: boolean) => void;
  onLegacyImport: () => void;
}

export function StockingToolsPanel({
  currentBundleCounts,
  desktopFileBusy,
  bundlePreview,
  bundleReplaceConfirmed,
  bundleStatus,
  bundleImportBusy,
  legacyPreview,
  legacyImportConfirmed,
  legacyStatus,
  legacyImportBusy,
  importFailureRecovery,
  onBundleExport,
  onDesktopBundleExport,
  onBundleFileChange,
  onDesktopBundleFileImport,
  onBundleReplaceConfirmedChange,
  onBundleImport,
  onLegacyFileChange,
  onLegacyImportConfirmedChange,
  onLegacyImport,
}: StockingToolsPanelProps) {
  return (
    <div className="bundle-panel">
      <p className="care-intro">
        Export and import DeKoi-native records as a readable JSON bundle.
      </p>

      <section className="bundle-section" aria-labelledby="bundle-export">
        <div className="catalog-section-head">
          <div>
            <h3 id="bundle-export">Export</h3>
            <span>current pond</span>
          </div>
          <button type="button" className="care-btn primary" onClick={onBundleExport}>
            Export JSON
          </button>
        </div>
        <BundleCounts counts={currentBundleCounts} />
        <div className="runtime-actions">
          <button type="button" disabled={desktopFileBusy} onClick={onDesktopBundleExport}>
            Export desktop file
          </button>
        </div>
        <p className="bundle-note">
          Remote Runtime URL is not included. Saved connection fields, excluding provider secrets,
          are included in exports.
        </p>
      </section>

      <section className="bundle-section" aria-labelledby="bundle-import">
        <div className="catalog-section-head">
          <div>
            <h3 id="bundle-import">Import</h3>
            <span>replace current records</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="dekoi-bundle-file">DeKoi JSON bundle</label>
          <input
            className="pondinput"
            id="dekoi-bundle-file"
            type="file"
            accept="application/json,.json"
            onChange={onBundleFileChange}
          />
          <div className="help">Import previews counts before anything is changed.</div>
        </div>

        <div className="runtime-actions">
          <button type="button" disabled={desktopFileBusy} onClick={onDesktopBundleFileImport}>
            Open desktop file
          </button>
        </div>

        {bundlePreview && (
          <BundleImportPreview
            preview={bundlePreview}
            replaceConfirmed={bundleReplaceConfirmed}
            onReplaceConfirmedChange={onBundleReplaceConfirmedChange}
          />
        )}

        {bundleStatus && <p className="bundle-status">{bundleStatus}</p>}
        {importFailureRecovery.source === "bundle" && (
          <StorageImportFailureActions
            source="bundle"
            restoreAvailable={importFailureRecovery.restoreAvailable}
            backupPath={importFailureRecovery.backupPath}
            restoreBusy={importFailureRecovery.restoreBusy}
            restoreConfirmed={importFailureRecovery.restoreConfirmed}
            onRestore={importFailureRecovery.onRestore}
            onAcknowledge={importFailureRecovery.onAcknowledge}
          />
        )}

        <div className="runtime-actions">
          <button
            type="button"
            className="care-btn primary"
            disabled={!bundlePreview || !bundleReplaceConfirmed || bundleImportBusy}
            onClick={onBundleImport}
          >
            {bundleImportBusy ? "Importing bundle" : "Import bundle"}
          </button>
        </div>
      </section>

      <section className="bundle-section" aria-labelledby="legacy-import">
        <div className="catalog-section-head">
          <div>
            <h3 id="legacy-import">Legacy import</h3>
            <span>add converted threads</span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="legacy-thread-file">Legacy thread JSON</label>
          <input
            className="pondinput"
            id="legacy-thread-file"
            type="file"
            accept="application/json,.json"
            onChange={onLegacyFileChange}
          />
          <div className="help">
            Supports previous thread export files. Converted records are added as native Messenger
            threads.
          </div>
        </div>

        {legacyPreview && (
          <LegacyImportPreview
            preview={legacyPreview}
            importConfirmed={legacyImportConfirmed}
            onImportConfirmedChange={onLegacyImportConfirmedChange}
          />
        )}
        {legacyStatus && <p className="bundle-status">{legacyStatus}</p>}
        {importFailureRecovery.source === "legacy" && (
          <StorageImportFailureActions
            source="legacy"
            restoreAvailable={importFailureRecovery.restoreAvailable}
            backupPath={importFailureRecovery.backupPath}
            restoreBusy={importFailureRecovery.restoreBusy}
            restoreConfirmed={importFailureRecovery.restoreConfirmed}
            onRestore={importFailureRecovery.onRestore}
            onAcknowledge={importFailureRecovery.onAcknowledge}
          />
        )}

        <div className="runtime-actions">
          <button
            type="button"
            className="care-btn primary"
            disabled={!legacyPreview || !legacyImportConfirmed || legacyImportBusy}
            onClick={onLegacyImport}
          >
            {legacyImportBusy ? "Importing records" : "Import converted records"}
          </button>
        </div>
      </section>
    </div>
  );
}
