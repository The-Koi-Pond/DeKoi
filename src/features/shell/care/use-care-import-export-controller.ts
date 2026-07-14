import { useState, type ChangeEvent } from "react";
import {
  exportCareDesktopBundleFile,
  importCareDesktopBundleFile,
  loadCareDesktopStorageBundle,
  previewCareLegacyImportFile,
  previewCareStorageBundleFile,
  saveCareDesktopStorageBundle,
  type DeKoiLegacyImportPreview,
  type CareStorageBundlePreview,
  type CareStorageImportCommitResult,
} from "../../runtime";
import type {
  NavCareActions,
  NavMacroVariableState,
  NavStorageActions,
  NavStorageBundleActions,
  NavStorageState,
} from "../../navigation";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import type { DeKoiDesktopHostStatus } from "../../../shared/api/desktop-host-status";
import { downloadJsonFile } from "../../../shared/browser/download-json";
import { errorMessage } from "../../../shared/errors";
import {
  createLegacyImportDataFingerprint,
  getLegacyImportPreviewWarnings,
} from "./use-app-import-export-actions";
import type { StorageImportFailureSource } from "./care-drawer-types";

type CareImportExportNav = Pick<NavCareActions, "setCareOpen" | "setCareTab"> &
  Pick<NavMacroVariableState, "macroVariableStates"> &
  Pick<
    NavStorageBundleActions,
    "createStorageBundle" | "importLegacyData" | "importStorageBundle"
  > &
  Pick<NavStorageActions, "flushAppStorageSaves" | "restoreLastPreImportBackup"> &
  Pick<NavStorageState, "importRecoveryState">;

type ImportBackupResult =
  | {
      ok: true;
      filename: string;
      path: string | null;
      verified: boolean;
      byteLength: number | null;
    }
  | { ok: false; message: string };

type PreparedLegacyImportPreview = DeKoiLegacyImportPreview & {
  fingerprint: string;
};

interface UseCareImportExportControllerInput {
  nav: CareImportExportNav;
  refreshDesktopHostStatus: () => Promise<DeKoiDesktopHostStatus>;
}

export function useCareImportExportController({
  nav,
  refreshDesktopHostStatus,
}: UseCareImportExportControllerInput) {
  const [desktopStorageBusy, setDesktopStorageBusy] = useState(false);
  const [desktopStorageStatus, setDesktopStorageStatus] = useState("");
  const [bundlePreview, setBundlePreview] = useState<CareStorageBundlePreview | null>(null);
  const [bundleReplaceConfirmed, setBundleReplaceConfirmed] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const [bundleImportBusy, setBundleImportBusy] = useState(false);
  const [desktopFileBusy, setDesktopFileBusy] = useState(false);
  const [storageImportFailureSource, setStorageImportFailureSource] =
    useState<StorageImportFailureSource | null>(null);
  const [storageImportRestoreConfirmed, setStorageImportRestoreConfirmed] = useState(false);
  const [storageImportRestoreBusy, setStorageImportRestoreBusy] = useState(false);
  const [legacyPreview, setLegacyPreview] = useState<PreparedLegacyImportPreview | null>(null);
  const [legacyImportConfirmed, setLegacyImportConfirmed] = useState(false);
  const [legacyImportBusy, setLegacyImportBusy] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState("");

  function clearStorageImportRecoveryUi() {
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);
    setStorageImportRestoreBusy(false);
  }

  function formatBytes(byteLength: number) {
    if (byteLength < 1024) return `${byteLength} B`;
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }

  function getBundleFilename() {
    return `dekoi-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function getImportBackupFilename() {
    return `dekoi-pre-import-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  }

  function formatFlushFailureMessage(result: {
    message: string;
    dirtyCollectionKeys: string[];
    failedCollectionKeys: string[];
  }) {
    const dirty =
      result.dirtyCollectionKeys.length > 0
        ? ` Dirty: ${result.dirtyCollectionKeys.join(", ")}.`
        : "";
    const failed =
      result.failedCollectionKeys.length > 0
        ? ` Failed: ${result.failedCollectionKeys.join(", ")}.`
        : "";
    return `${result.message}${dirty}${failed}`;
  }

  async function createStorageBundleAfterFlush(reason: "backup" | "export" | "import") {
    const flushResult = await nav.flushAppStorageSaves({ reason });
    if (!flushResult.flushed) {
      return {
        ok: false as const,
        message: formatFlushFailureMessage(flushResult),
      };
    }

    return { ok: true as const, bundle: nav.createStorageBundle() };
  }

  async function createPreImportBackup(backupFilename: string): Promise<ImportBackupResult> {
    const backupBundleResult = await createStorageBundleAfterFlush("import");
    if (!backupBundleResult.ok) {
      return {
        ok: false,
        message: `Storage flush failed. Import was not started. ${backupBundleResult.message}`,
      };
    }
    const backupBundle = backupBundleResult.bundle;

    if (isDesktopHostAvailable()) {
      try {
        const info = await exportCareDesktopBundleFile(backupBundle, backupFilename);
        if (!info) {
          return {
            ok: false,
            message: "Pre-import backup was cancelled. Import was not started.",
          };
        }

        return {
          ok: true,
          filename: backupFilename,
          path: info.path,
          verified: true,
          byteLength: info.byteLength,
        };
      } catch (error) {
        return {
          ok: false,
          message: `Pre-import backup failed. Import was not started. ${errorMessage(error)}`,
        };
      }
    }

    try {
      downloadJsonFile({
        data: backupBundle,
        filename: backupFilename,
      });
      return {
        ok: true,
        filename: backupFilename,
        path: null,
        verified: false,
        byteLength: null,
      };
    } catch (error) {
      return {
        ok: false,
        message: `Pre-import backup download failed. Import was not started. ${errorMessage(
          error,
        )}`,
      };
    }
  }

  function formatImportBackupReference(backup: Extract<ImportBackupResult, { ok: true }>) {
    if (backup.verified) {
      return backup.path
        ? `Pre-import backup saved: ${backup.path}.`
        : `Pre-import backup saved: ${backup.filename}.`;
    }

    return `If your browser saved the pre-import backup, it is named: ${backup.filename}.`;
  }

  function formatImportBackupCreatedStatus(backup: Extract<ImportBackupResult, { ok: true }>) {
    const backupSize = backup.byteLength === null ? "" : ` (${formatBytes(backup.byteLength)})`;

    return backup.verified
      ? `Created pre-import backup${backupSize}.`
      : `Requested browser download for pre-import backup: ${backup.filename}.`;
  }

  function formatImportCommitResult(result: CareStorageImportCommitResult) {
    if (result.status === "ready") return result.message;

    const completedCollections = result.collections.filter(
      (collection) => collection.status === "ready",
    ).length;
    const failedCollection = result.failedCollectionKey
      ? result.collections.find(
          (collection) => collection.collectionKey === result.failedCollectionKey,
        )
      : null;
    const failedDetail = failedCollection
      ? ` Failed collection: ${failedCollection.collectionKey} (${failedCollection.count} record(s)).`
      : "";

    return `${result.message} ${completedCollections}/${Object.keys(result.counts).length} collection(s) were replaced before the failure.${failedDetail}`;
  }

  async function handleDesktopStorageSave() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Flushing storage before host bundle save...");

    try {
      const bundleResult = await createStorageBundleAfterFlush("export");
      if (!bundleResult.ok) {
        setDesktopStorageStatus(bundleResult.message);
        return;
      }

      setDesktopStorageStatus("Saving desktop host bundle...");
      const info = await saveCareDesktopStorageBundle(bundleResult.bundle);
      await refreshDesktopHostStatus();
      setDesktopStorageStatus(`Saved desktop host bundle (${formatBytes(info.byteLength)}).`);
    } catch (error) {
      setDesktopStorageStatus(errorMessage(error));
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  async function handleDesktopStorageLoad() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Loading desktop host bundle...");

    try {
      const result = await loadCareDesktopStorageBundle();
      if (!result.ok) {
        setDesktopStorageStatus(result.error);
        return;
      }

      setBundlePreview({
        bundle: result.bundle,
        counts: result.counts,
        fingerprint: result.fingerprint,
        warnings: result.warnings,
      });
      setBundleReplaceConfirmed(false);
      await refreshDesktopHostStatus();
      setDesktopStorageStatus(
        result.warnings.length > 0
          ? `Previewing desktop host bundle with ${result.warnings.length} warning(s).`
          : `Previewing desktop host bundle (${formatBytes(result.info.byteLength)}).`,
      );
      setBundleStatus("Confirm replacement to import the desktop host bundle.");
    } catch (error) {
      setDesktopStorageStatus(errorMessage(error));
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  async function handleBundleExport() {
    setBundleStatus("Flushing storage before export...");

    try {
      const bundleResult = await createStorageBundleAfterFlush("export");
      if (!bundleResult.ok) {
        setBundleStatus(bundleResult.message);
        return;
      }

      downloadJsonFile({
        data: bundleResult.bundle,
        filename: getBundleFilename(),
      });
      setBundleStatus("Exported a DeKoi JSON bundle.");
    } catch (error) {
      setBundleStatus(errorMessage(error));
    }
  }

  async function handleDesktopBundleExport() {
    setDesktopFileBusy(true);
    setBundleStatus("Flushing storage before desktop export...");

    try {
      const bundleResult = await createStorageBundleAfterFlush("export");
      if (!bundleResult.ok) {
        setBundleStatus(bundleResult.message);
        return;
      }

      setBundleStatus("Opening desktop save dialog...");
      const info = await exportCareDesktopBundleFile(bundleResult.bundle, getBundleFilename());
      setBundleStatus(
        info
          ? `Exported desktop bundle (${formatBytes(info.byteLength)}).`
          : "Desktop export cancelled.",
      );
    } catch (error) {
      setBundleStatus(errorMessage(error));
    } finally {
      setDesktopFileBusy(false);
    }
  }

  async function handleBundleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setBundleStatus("");
    setBundlePreview(null);
    setBundleReplaceConfirmed(false);
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);

    if (!file) return;

    const result = await previewCareStorageBundleFile(file);
    if (!result.ok) {
      setBundleStatus(result.error);
      input.value = "";
      return;
    }

    setBundlePreview(result.preview);
    setBundleStatus(`Previewing ${file.name}.`);
    input.value = "";
  }

  async function handleBundleImport() {
    if (!bundlePreview) return;
    if (!bundleReplaceConfirmed) {
      setBundleStatus("Confirm replacement before importing.");
      return;
    }

    const backupFilename = getImportBackupFilename();
    setBundleImportBusy(true);
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);
    setBundleStatus("Creating pre-import backup...");
    let backup: Extract<ImportBackupResult, { ok: true }> | null = null;

    try {
      const backupResult = await createPreImportBackup(backupFilename);
      if (!backupResult.ok) {
        setBundleStatus(backupResult.message);
        return;
      }

      backup = backupResult;
      setBundleStatus(`${formatImportBackupCreatedStatus(backup)} Importing DeKoi bundle...`);

      const result = await nav.importStorageBundle(bundlePreview.bundle, {
        previewFingerprint: bundlePreview.fingerprint,
        desktopBackupPath: backup.path,
      });
      const resultMessage = formatImportCommitResult(result);
      if (result.status !== "ready") {
        setBundleReplaceConfirmed(false);
        setStorageImportFailureSource("bundle");
        nav.setCareOpen(true);
        nav.setCareTab(4);
        setBundleStatus(`Import failed. ${formatImportBackupReference(backup)} ${resultMessage}`);
        return;
      }

      setBundleStatus(
        `Imported DeKoi bundle. ${formatImportBackupReference(backup)} ${resultMessage}`,
      );
      setBundlePreview(null);
      setBundleReplaceConfirmed(false);
    } catch (error) {
      setBundleReplaceConfirmed(false);
      setStorageImportFailureSource("bundle");
      nav.setCareOpen(true);
      nav.setCareTab(4);
      setBundleStatus(
        `Import failed. ${
          backup ? formatImportBackupReference(backup) : "Pre-import backup was not created."
        } ${errorMessage(error)}`,
      );
    } finally {
      setBundleImportBusy(false);
    }
  }

  async function handleDesktopBundleFileImport() {
    setDesktopFileBusy(true);
    setBundleStatus("Opening desktop import dialog...");
    setBundlePreview(null);
    setBundleReplaceConfirmed(false);
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);

    try {
      const result = await importCareDesktopBundleFile();
      if (!result.ok) {
        setBundleStatus(result.cancelled ? "Desktop import cancelled." : result.error);
        return;
      }

      setBundlePreview({
        bundle: result.bundle,
        counts: result.counts,
        fingerprint: result.fingerprint,
        warnings: result.warnings,
      });
      setBundleStatus(`Previewing desktop bundle (${formatBytes(result.info.byteLength)}).`);
    } catch (error) {
      setBundleStatus(errorMessage(error));
    } finally {
      setDesktopFileBusy(false);
    }
  }

  async function handleLegacyFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setLegacyStatus("");
    setLegacyPreview(null);
    setLegacyImportConfirmed(false);
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);

    if (!file) return;

    const result = await previewCareLegacyImportFile(file);
    if (!result.ok) {
      setLegacyStatus(result.error);
      input.value = "";
      return;
    }

    setLegacyPreview({
      ...result.preview,
      fingerprint: createLegacyImportDataFingerprint(result.preview.data),
      warnings: getLegacyImportPreviewWarnings(
        result.preview.warnings,
        result.preview.data.macroVariableStates,
        nav.macroVariableStates,
      ),
    });
    setLegacyStatus(`Previewing ${file.name}.`);
    input.value = "";
  }

  async function handleLegacyImport() {
    if (!legacyPreview) return;
    if (!legacyImportConfirmed) {
      setLegacyStatus("Confirm import before adding converted records.");
      return;
    }

    const backupFilename = getImportBackupFilename();
    setLegacyImportBusy(true);
    setStorageImportFailureSource(null);
    setStorageImportRestoreConfirmed(false);
    setLegacyStatus("Creating pre-import backup...");
    let backup: Extract<ImportBackupResult, { ok: true }> | null = null;

    try {
      const backupResult = await createPreImportBackup(backupFilename);
      if (!backupResult.ok) {
        setLegacyStatus(backupResult.message);
        return;
      }

      backup = backupResult;
      setLegacyStatus(`${formatImportBackupCreatedStatus(backup)} Importing converted records...`);

      const result = await nav.importLegacyData(legacyPreview.data, {
        previewFingerprint: legacyPreview.fingerprint,
        desktopBackupPath: backup.path,
      });
      if (result.status !== "ready") {
        setLegacyPreview(null);
        setLegacyImportConfirmed(false);
        setStorageImportFailureSource("legacy");
        nav.setCareOpen(true);
        nav.setCareTab(4);
        setLegacyStatus(
          `Legacy import failed. ${formatImportBackupReference(backup)} ${formatImportCommitResult(result)}`,
        );
        return;
      }

      setLegacyStatus(
        `Imported converted legacy threads. ${formatImportBackupReference(backup)} ${result.message}`,
      );
      setLegacyPreview(null);
      setLegacyImportConfirmed(false);
    } catch (error) {
      setLegacyPreview(null);
      setLegacyImportConfirmed(false);
      setStorageImportFailureSource("legacy");
      nav.setCareOpen(true);
      nav.setCareTab(4);
      setLegacyStatus(
        `Legacy import failed. ${
          backup ? formatImportBackupReference(backup) : "Pre-import backup was not created."
        } ${errorMessage(error)}`,
      );
    } finally {
      setLegacyImportBusy(false);
    }
  }

  function acknowledgeStorageImportFailure() {
    if (storageImportFailureSource === "bundle") {
      setBundleStatus("");
      setBundleReplaceConfirmed(false);
    } else if (storageImportFailureSource === "legacy") {
      setLegacyStatus("");
      setLegacyImportConfirmed(false);
    }

    setStorageImportRestoreConfirmed(false);
    setStorageImportFailureSource(null);
  }

  function setStorageImportFailureStatus(message: string) {
    if (storageImportFailureSource === "legacy") {
      setLegacyStatus(message);
    } else {
      setBundleStatus(message);
    }
  }

  function showImportFailureCloseRequiredStatus() {
    if (storageImportFailureSource === "bundle") {
      setBundleStatus(
        (current) => current || "Acknowledge the import failure before closing Settings.",
      );
    } else if (storageImportFailureSource === "legacy") {
      setLegacyStatus(
        (current) => current || "Acknowledge the import failure before closing Settings.",
      );
    }
  }

  async function handleRestorePreImportBackup() {
    if (!nav.importRecoveryState.available) {
      setStorageImportFailureStatus(
        "No in-session pre-import backup is available. Import the saved backup file instead.",
      );
      return;
    }

    if (!storageImportRestoreConfirmed) {
      setStorageImportRestoreConfirmed(true);
      setStorageImportFailureStatus(
        "Restore will replace current DeKoi records with the backup created before this import. Select Restore pre-import backup again to continue.",
      );
      return;
    }

    setStorageImportRestoreBusy(true);
    setStorageImportFailureStatus("Restoring pre-import backup...");
    const source = storageImportFailureSource;

    try {
      const result = await nav.restoreLastPreImportBackup();
      if (result.status !== "ready") {
        setStorageImportRestoreConfirmed(false);
        setStorageImportFailureStatus(
          `Restore failed. Import the saved pre-import backup file if needed. ${formatImportCommitResult(result)}`,
        );
        return;
      }

      setBundleReplaceConfirmed(false);
      setLegacyImportConfirmed(false);
      setStorageImportFailureSource(null);
      setStorageImportRestoreConfirmed(false);
      if (source === "legacy") {
        setLegacyStatus(`Restored pre-import backup. ${result.message}`);
        setBundleStatus("");
      } else {
        setBundleStatus(`Restored pre-import backup. ${result.message}`);
        setLegacyStatus("");
      }
    } catch (error) {
      setStorageImportRestoreConfirmed(false);
      setStorageImportFailureStatus(
        `Restore failed. Import the saved pre-import backup file if needed. ${errorMessage(error)}`,
      );
    } finally {
      setStorageImportRestoreBusy(false);
    }
  }

  return {
    desktopStorageBusy,
    desktopStorageStatus,
    bundlePreview,
    bundleReplaceConfirmed,
    bundleStatus,
    bundleImportBusy,
    desktopFileBusy,
    storageImportFailureSource,
    storageImportRestoreConfirmed,
    storageImportRestoreBusy,
    legacyPreview,
    legacyImportConfirmed,
    legacyImportBusy,
    legacyStatus,
    clearStorageImportRecoveryUi,
    setBundleReplaceConfirmed,
    setLegacyImportConfirmed,
    handleDesktopStorageSave,
    handleDesktopStorageLoad,
    handleBundleExport,
    handleDesktopBundleExport,
    handleBundleFileChange,
    handleBundleImport,
    handleDesktopBundleFileImport,
    handleLegacyFileChange,
    handleLegacyImport,
    acknowledgeStorageImportFailure,
    handleRestorePreImportBackup,
    showImportFailureCloseRequiredStatus,
  };
}
