import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type {
  NavCareActions,
  NavCareState,
  NavCatalogState,
  NavRippleState,
  NavSettingsActions,
  NavSettingsState,
  NavStorageActions,
  NavStorageBundleActions,
  NavStorageState,
  NavThreadState,
} from "../../navigation";
import { Switch } from "../../../shared/ui/primitives/Switch";
import { Slider } from "../../../shared/ui/primitives/Slider";
import { NumberField } from "../../../shared/ui/primitives/NumberField";
import { Seg } from "../../../shared/ui/primitives/Seg";
import { Chip } from "../../../shared/ui/primitives/Chip";
import { SettingSection } from "./SettingSection";
import { ROLEPLAY, MESSENGER, RESERVED } from "../../../engine/contracts/constants/surfaces";
import {
  getDeKoiStorageBundleCounts,
  exportDesktopBundleFile,
  finishAppStorageCollectionRepair,
  importDesktopBundleFile,
  loadAppStorageRepairStatus,
  readDesktopStorageBundle,
  repairAppStorageCollection,
  writeDesktopStorageBundle,
  previewDeKoiStorageBundleFile,
  previewLegacyImportFile,
  type AppStorageRepairCollectionStatus,
  type AppStorageRepairStatusResult,
  type AppStorageRepairStrategy,
  type AppStorageReplaceResult,
  type DeKoiStorageBundleCounts,
  type DeKoiStorageBundlePreview,
  type DeKoiLegacyImportPreview,
} from "../../runtime";
import {
  checkDesktopHostStatus,
  type DeKoiDesktopHostStatus,
} from "../../../shared/api/desktop-host-status";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import { DESKTOP_RUNTIME_URL } from "../../../shared/api/runtime-target";
import { checkRemoteRuntimeHealth } from "../../../shared/api/remote-runtime";
import { downloadJsonFile } from "../../../shared/browser/download-json";
import { CARE_TABS } from "./care-tabs";
import "./CareDrawer.css";
import "./care-fields.css";
import "../../../shared/ui/primitives/Chip.css";

interface CareDrawerProps {
  nav: CareDrawerNav;
}

export type CareDrawerNav = Pick<NavCareActions, "setCareOpen" | "setCareTab"> &
  Pick<NavCareState, "careOpen" | "careTab"> &
  Pick<
    NavCatalogState,
    "characters" | "lorebooks" | "personas" | "providerConnections"
  > &
  Pick<NavRippleState, "rippleStates"> &
  Pick<
    NavSettingsActions,
    | "setConfirmRelease"
    | "setRemoteRuntimeUrl"
    | "setSendOnEnterSurface"
    | "updateAppSettings"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<
    NavStorageBundleActions,
    "createStorageBundle" | "importLegacyData" | "importStorageBundle"
  > &
  Pick<NavStorageActions, "checkAppStorageStale" | "reloadAppStorage"> &
  Pick<
    NavStorageState,
    | "messengerStorageMessage"
    | "messengerStorageMode"
    | "messengerStorageStatus"
    | "storageHasUnsavedChanges"
    | "remoteRuntimeUrl"
  > &
  Pick<NavThreadState, "roleplayThreads" | "messengerThreads">;

// DeKoi-native surface ids for the Send-on-Enter segmented control.
const SEND_ON_ENTER_SURFACES = [
  { value: ROLEPLAY, label: "Roleplay" },
  { value: MESSENGER, label: "Messenger" },
  { value: RESERVED, label: "Reserved" },
] as const;

type ImportBackupResult =
  | {
      ok: true;
      filename: string;
      path: string | null;
      verified: boolean;
      byteLength: number | null;
    }
  | { ok: false; message: string };

type StorageImportFailureSource = "bundle" | "legacy";
type StorageRepairConfirmationAction =
  | AppStorageRepairStrategy
  | "finish-repair";

export function CareDrawer({ nav }: CareDrawerProps) {
  const open = nav.careOpen;
  const setCareOpen = nav.setCareOpen;
  const setCareTab = nav.setCareTab;

  // Product settings live in nav.appSettings and persist across reloads.
  const {
    streamReplies,
    rippleSpeed,
    surfaceAllText,
    wheelNavigate,
    narrationDrift,
    autoplayPause,
    accent,
    motion,
    density,
    fontScale,
    defaultTemperature,
    defaultMaxTokens,
    defaultTopP,
  } = nav.appSettings;
  const [runtimeUrl, setRuntimeUrl] = useState(nav.remoteRuntimeUrl);
  const [runtimeHealth, setRuntimeHealth] = useState("");
  const [desktopHostStatus, setDesktopHostStatus] =
    useState<DeKoiDesktopHostStatus | null>(null);
  const [desktopHostBusy, setDesktopHostBusy] = useState(false);
  const [desktopStorageBusy, setDesktopStorageBusy] = useState(false);
  const [desktopStorageStatus, setDesktopStorageStatus] = useState("");
  const [storageReloadBusy, setStorageReloadBusy] = useState(false);
  const [storageReloadStatus, setStorageReloadStatus] = useState("");
  const [storageRepairStatus, setStorageRepairStatus] =
    useState<AppStorageRepairStatusResult | null>(null);
  const [storageRepairBusy, setStorageRepairBusy] = useState<string | null>(
    null,
  );
  const [storageRepairConfirmation, setStorageRepairConfirmation] =
    useState<string | null>(null);
  const [bundlePreview, setBundlePreview] =
    useState<DeKoiStorageBundlePreview | null>(null);
  const [bundleReplaceConfirmed, setBundleReplaceConfirmed] = useState(false);
  const [bundleStatus, setBundleStatus] = useState("");
  const [bundleImportBusy, setBundleImportBusy] = useState(false);
  const [desktopFileBusy, setDesktopFileBusy] = useState(false);
  const [storageImportFailureSource, setStorageImportFailureSource] =
    useState<StorageImportFailureSource | null>(null);
  const [legacyPreview, setLegacyPreview] =
    useState<DeKoiLegacyImportPreview | null>(null);
  const [legacyImportConfirmed, setLegacyImportConfirmed] = useState(false);
  const [legacyImportBusy, setLegacyImportBusy] = useState(false);
  const [legacyStatus, setLegacyStatus] = useState("");
  const runtimeStatusMessage = runtimeHealth || nav.messengerStorageMessage;
  const currentBundleCounts = getDeKoiStorageBundleCounts({
    appSettings: nav.appSettings,
    characters: nav.characters,
    roleplayThreads: nav.roleplayThreads,
    lorebooks: nav.lorebooks,
    messengerThreads: nav.messengerThreads,
    personas: nav.personas,
    providerConnections: nav.providerConnections,
    rippleStates: nav.rippleStates,
  });

  useEffect(() => {
    if (!storageImportFailureSource || open) return;

    setCareOpen(true);
    setCareTab(4);
  }, [open, setCareOpen, setCareTab, storageImportFailureSource]);

  function handleRuntimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuntimeHealth("");
    nav.setRemoteRuntimeUrl(runtimeUrl);
  }

  async function handleRuntimeTest() {
    setRuntimeHealth("Checking remote runtime...");
    const health = await checkRemoteRuntimeHealth(runtimeUrl);
    setRuntimeHealth(health.message);
  }

  function handleUseLocalStorage() {
    setRuntimeUrl("");
    nav.setRemoteRuntimeUrl("");
    setRuntimeHealth(
      "Using desktop host storage when available; otherwise this browser session is temporary.",
    );
  }

  function handleUseDesktopRuntime() {
    setRuntimeUrl(DESKTOP_RUNTIME_URL);
    nav.setRemoteRuntimeUrl(DESKTOP_RUNTIME_URL);
    setRuntimeHealth("Desktop runtime selected for storage and profile data.");
  }

  async function handleDesktopHostCheck() {
    setDesktopHostBusy(true);
    setDesktopHostStatus({
      appName: "DeKoi",
      hostKind: "browser",
      storageReady: false,
      secretsReady: false,
      runtimeReady: false,
      message: "Checking desktop host...",
    });
    const status = await checkDesktopHostStatus();
    setDesktopHostStatus(status);
    setDesktopHostBusy(false);
  }

  function formatBytes(byteLength: number) {
    if (byteLength < 1024) return `${byteLength} B`;
    return `${(byteLength / 1024).toFixed(1)} KB`;
  }

  async function refreshDesktopHostStatus() {
    const status = await checkDesktopHostStatus();
    setDesktopHostStatus(status);
    return status;
  }

  async function handleDesktopStorageSave() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Saving desktop host bundle...");

    try {
      const info = await writeDesktopStorageBundle(nav.createStorageBundle());
      await refreshDesktopHostStatus();
      setDesktopStorageStatus(
        `Saved desktop host bundle (${formatBytes(info.byteLength)}).`,
      );
    } catch (error) {
      setDesktopStorageStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  async function handleDesktopStorageLoad() {
    setDesktopStorageBusy(true);
    setDesktopStorageStatus("Loading desktop host bundle...");

    try {
      const result = await readDesktopStorageBundle();
      if (!result.ok) {
        setDesktopStorageStatus(result.error);
        return;
      }

      setBundlePreview({
        bundle: result.bundle,
        counts: result.counts,
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
      setDesktopStorageStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setDesktopStorageBusy(false);
    }
  }

  function storageRepairActionKey(
    entity: string,
    action: StorageRepairConfirmationAction,
  ) {
    return `${entity}:${action}`;
  }

  function storageRepairConfirmationMatches(
    collection: AppStorageRepairCollectionStatus,
    action: StorageRepairConfirmationAction,
  ) {
    return (
      storageRepairConfirmation ===
      storageRepairActionKey(collection.entity, action)
    );
  }

  async function refreshStorageRepairStatus() {
    const result = await loadAppStorageRepairStatus(nav.remoteRuntimeUrl);
    setStorageRepairStatus(result);
    return result;
  }

  function findStorageRepairStatus(
    status: AppStorageRepairStatusResult,
    collection: AppStorageRepairCollectionStatus,
  ) {
    return status.collections.find(
      (item) => item.entity === collection.entity,
    );
  }

  function formatRepairConfirmationProblem(
    collection: AppStorageRepairCollectionStatus,
    status: AppStorageRepairStatusResult,
  ) {
    const current = findStorageRepairStatus(status, collection);
    if (!current) return "";

    return current.error
      ? ` ${current.error}`
      : ` ${current.label} still has repair work pending.`;
  }

  async function handleStorageStaleCheck() {
    setStorageReloadBusy(true);
    setStorageReloadStatus("Checking stored collections...");

    try {
      const result = await nav.checkAppStorageStale();
      const repairStatus = await refreshStorageRepairStatus();
      const changedCount = result.changedCollectionKeys.length;
      const repairMessage =
        repairStatus.collections.length > 0 ? ` ${repairStatus.message}` : "";
      const statusMessage =
        result.stale && changedCount > 0
          ? `${result.message} ${changedCount} collection(s) changed.`
          : result.message;
      setStorageReloadStatus(`${statusMessage}${repairMessage}`);
    } catch (error) {
      setStorageReloadStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setStorageReloadBusy(false);
    }
  }

  async function handleStorageReload() {
    setStorageReloadBusy(true);
    setStorageReloadStatus("Reloading stored collections...");

    try {
      const result = await nav.reloadAppStorage();
      const repairStatus = await refreshStorageRepairStatus();
      const repairMessage =
        repairStatus.collections.length > 0 ? ` ${repairStatus.message}` : "";
      setStorageReloadStatus(`${result.message}${repairMessage}`);
    } catch (error) {
      setStorageReloadStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setStorageReloadBusy(false);
    }
  }

  async function handleStorageRepair(
    collection: AppStorageRepairCollectionStatus,
    strategy: AppStorageRepairStrategy,
  ) {
    if (!collection.known) {
      setStorageReloadStatus(
        `${collection.label} cannot be repaired by this app version.`,
      );
      return;
    }

    const actionKey = storageRepairActionKey(collection.entity, strategy);
    if (storageRepairConfirmation !== actionKey) {
      setStorageRepairConfirmation(actionKey);
      setStorageReloadStatus(
        strategy === "restore-backup"
          ? `Select Restore backup again to repair ${collection.label}.`
          : `Select Replace empty again to erase and repair ${collection.label}.`,
      );
      return;
    }

    setStorageRepairBusy(actionKey);
    setStorageRepairConfirmation(null);
    setStorageReloadStatus(`Repairing ${collection.label}...`);

    try {
      const result = await repairAppStorageCollection({
        entity: collection.entity,
        strategy,
        confirm: true,
        rawUrl: nav.remoteRuntimeUrl,
      });
      if (result.status !== "ready") {
        setStorageReloadStatus(result.message);
        return;
      }

      const repairStatus = await refreshStorageRepairStatus();
      const postRepairStatus = findStorageRepairStatus(
        repairStatus,
        collection,
      );
      if (postRepairStatus?.error) {
        setStorageReloadStatus(
          `Repair did not produce a readable ${collection.label}. ${postRepairStatus.error}`,
        );
        return;
      }

      const reloadResult = await nav.reloadAppStorage();
      const confirmedRepairStatus = await refreshStorageRepairStatus();
      if (reloadResult.status !== "ready" || !reloadResult.reloaded) {
        setStorageReloadStatus(
          `Repair command completed, but storage reload did not confirm ${collection.label}. ${reloadResult.message}${formatRepairConfirmationProblem(
            collection,
            confirmedRepairStatus,
          )}`,
        );
        return;
      }

      const confirmedTargetStatus = findStorageRepairStatus(
        confirmedRepairStatus,
        collection,
      );
      if (confirmedTargetStatus?.error) {
        setStorageReloadStatus(
          `Repair command completed, but metadata still reports a problem for ${collection.label}. ${confirmedTargetStatus.error}`,
        );
        return;
      }

      const needsFinish = confirmedTargetStatus?.canFinishRepair ?? false;
      const finishMessage = needsFinish
        ? " Finish repair after you verify the reloaded records."
        : "";
      setStorageReloadStatus(
        `${result.message} ${reloadResult.message}${finishMessage}`,
      );
    } catch (error) {
      setStorageReloadStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setStorageRepairBusy(null);
    }
  }

  async function handleStorageRepairFinish(
    collection: AppStorageRepairCollectionStatus,
  ) {
    if (!collection.known) {
      setStorageReloadStatus(
        `${collection.label} cannot be finished by this app version.`,
      );
      return;
    }

    const actionKey = storageRepairActionKey(
      collection.entity,
      "finish-repair",
    );
    if (storageRepairConfirmation !== actionKey) {
      setStorageRepairConfirmation(actionKey);
      setStorageReloadStatus(
        `Select Finish repair again to clear the pre-repair copy for ${collection.label}.`,
      );
      return;
    }

    setStorageRepairBusy(actionKey);
    setStorageRepairConfirmation(null);
    setStorageReloadStatus(`Finishing repair for ${collection.label}...`);

    try {
      const result = await finishAppStorageCollectionRepair({
        entity: collection.entity,
        confirm: true,
        rawUrl: nav.remoteRuntimeUrl,
      });
      const repairStatus = await refreshStorageRepairStatus();
      setStorageReloadStatus(`${result.message} ${repairStatus.message}`);
    } catch (error) {
      setStorageReloadStatus(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setStorageRepairBusy(null);
    }
  }

  function getBundleFilename() {
    return `dekoi-bundle-${new Date().toISOString().slice(0, 10)}.json`;
  }

  function getImportBackupFilename() {
    return `dekoi-pre-import-backup-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
  }

  async function createPreImportBackup(
    backupFilename: string,
  ): Promise<ImportBackupResult> {
    const backupBundle = nav.createStorageBundle();

    if (isDesktopHostAvailable()) {
      try {
        const info = await exportDesktopBundleFile(
          backupBundle,
          backupFilename,
        );
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
          message: `Pre-import backup failed. Import was not started. ${
            error instanceof Error ? error.message : String(error)
          }`,
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
        message: `Pre-import backup download failed. Import was not started. ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  function formatImportBackupReference(
    backup: Extract<ImportBackupResult, { ok: true }>,
  ) {
    if (backup.verified) {
      return backup.path
        ? `Pre-import backup saved: ${backup.path}.`
        : `Pre-import backup saved: ${backup.filename}.`;
    }

    return `If your browser saved the pre-import backup, it is named: ${backup.filename}.`;
  }

  function formatImportBackupCreatedStatus(
    backup: Extract<ImportBackupResult, { ok: true }>,
  ) {
    const backupSize =
      backup.byteLength === null ? "" : ` (${formatBytes(backup.byteLength)})`;

    return backup.verified
      ? `Created pre-import backup${backupSize}.`
      : `Requested browser download for pre-import backup: ${backup.filename}.`;
  }

  function formatImportCommitResult(result: AppStorageReplaceResult) {
    if (result.status === "ready") return result.message;

    const completedCollections = result.collections.filter(
      (collection) => collection.status === "ready",
    ).length;
    const failedCollection = result.failedCollectionKey
      ? result.collections.find(
          (collection) =>
            collection.collectionKey === result.failedCollectionKey,
        )
      : null;
    const failedDetail = failedCollection
      ? ` Failed collection: ${failedCollection.collectionKey} (${failedCollection.count} record(s)).`
      : "";

    return `${result.message} ${completedCollections}/${Object.keys(result.counts).length} collection(s) were replaced before the failure.${failedDetail}`;
  }

  function handleBundleExport() {
    downloadJsonFile({
      data: nav.createStorageBundle(),
      filename: getBundleFilename(),
    });
    setBundleStatus("Exported a DeKoi JSON bundle.");
  }

  async function handleDesktopBundleExport() {
    setDesktopFileBusy(true);
    setBundleStatus("Opening desktop save dialog...");

    try {
      const info = await exportDesktopBundleFile(
        nav.createStorageBundle(),
        getBundleFilename(),
      );
      setBundleStatus(
        info
          ? `Exported desktop bundle (${formatBytes(info.byteLength)}).`
          : "Desktop export cancelled.",
      );
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : String(error));
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

    if (!file) return;

    const result = await previewDeKoiStorageBundleFile(file);
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
    setBundleStatus("Creating pre-import backup...");
    let backup: Extract<ImportBackupResult, { ok: true }> | null = null;

    try {
      const backupResult = await createPreImportBackup(backupFilename);
      if (!backupResult.ok) {
        setBundleStatus(backupResult.message);
        return;
      }

      backup = backupResult;
      setBundleStatus(
        `${formatImportBackupCreatedStatus(backup)} Importing DeKoi bundle...`,
      );

      const result = await nav.importStorageBundle(bundlePreview.bundle);
      const resultMessage = formatImportCommitResult(result);
      if (result.status !== "ready") {
        setBundleReplaceConfirmed(false);
        setStorageImportFailureSource("bundle");
        setCareOpen(true);
        setCareTab(4);
        setBundleStatus(
          `Import failed. ${formatImportBackupReference(backup)} ${resultMessage}`,
        );
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
      setCareOpen(true);
      setCareTab(4);
      setBundleStatus(
        `Import failed. ${
          backup
            ? formatImportBackupReference(backup)
            : "Pre-import backup was not created."
        } ${error instanceof Error ? error.message : String(error)}`,
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

    try {
      const result = await importDesktopBundleFile();
      if (!result.ok) {
        setBundleStatus(
          result.cancelled ? "Desktop import cancelled." : result.error,
        );
        return;
      }

      setBundlePreview({
        bundle: result.bundle,
        counts: result.counts,
        warnings: result.warnings,
      });
      setBundleStatus(
        `Previewing desktop bundle (${formatBytes(result.info.byteLength)}).`,
      );
    } catch (error) {
      setBundleStatus(error instanceof Error ? error.message : String(error));
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

    if (!file) return;

    const result = await previewLegacyImportFile(file);
    if (!result.ok) {
      setLegacyStatus(result.error);
      input.value = "";
      return;
    }

    setLegacyPreview(result.preview);
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
    setLegacyStatus("Creating pre-import backup...");
    let backup: Extract<ImportBackupResult, { ok: true }> | null = null;

    try {
      const backupResult = await createPreImportBackup(backupFilename);
      if (!backupResult.ok) {
        setLegacyStatus(backupResult.message);
        return;
      }

      backup = backupResult;
      setLegacyStatus(
        `${formatImportBackupCreatedStatus(backup)} Importing converted records...`,
      );

      const result = await nav.importLegacyData(legacyPreview.data);
      if (result.status !== "ready") {
        setLegacyImportConfirmed(false);
        setStorageImportFailureSource("legacy");
        setCareOpen(true);
        setCareTab(4);
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
      setLegacyImportConfirmed(false);
      setStorageImportFailureSource("legacy");
      setCareOpen(true);
      setCareTab(4);
      setLegacyStatus(
        `Legacy import failed. ${
          backup
            ? formatImportBackupReference(backup)
            : "Pre-import backup was not created."
        } ${error instanceof Error ? error.message : String(error)}`,
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

    setStorageImportFailureSource(null);
  }

  function handleCareClose() {
    if (storageImportFailureSource) {
      setCareOpen(true);
      setCareTab(4);
      if (storageImportFailureSource === "bundle") {
        setBundleStatus((current) =>
          current || "Acknowledge the import failure before closing Settings.",
        );
      } else {
        setLegacyStatus((current) =>
          current || "Acknowledge the import failure before closing Settings.",
        );
      }
      return;
    }

    setCareOpen(false);
  }

  function renderBundleCounts(counts: DeKoiStorageBundleCounts) {
    return (
      <div className="bundle-counts">
        <span>
          <b>{counts.characters}</b> companions
        </span>
        <span>
          <b>{counts.personas}</b> personas
        </span>
        <span>
          <b>{counts.roleplayThreads}</b> Roleplay threads
        </span>
        <span>
          <b>{counts.roleplayEntries}</b> Roleplay turns
        </span>
        <span>
          <b>{counts.lorebooks}</b> lorebooks
        </span>
        <span>
          <b>{counts.lorebookEntries}</b> lore entries
        </span>
        <span>
          <b>{counts.providerConnections}</b> connections
        </span>
        <span>
          <b>{counts.messengerThreads}</b> threads
        </span>
        <span>
          <b>{counts.messengerMessages}</b> messages
        </span>
        <span>
          <b>{counts.rippleStates}</b> Ripple states
        </span>
        <span>
          <b>{counts.ripples}</b> Ripples
        </span>
      </div>
    );
  }

  function renderLegacyPreview(preview: DeKoiLegacyImportPreview) {
    return (
      <div className="bundle-preview">
        <b>Legacy import preview</b>
        <div className="bundle-counts">
          <span>
            <b>{preview.counts.messengerThreads}</b> Messenger threads
          </span>
          <span>
            <b>{preview.counts.messengerMessages}</b> messages
          </span>
        </div>
        <p className="bundle-note">Source: {preview.data.sourceLabel}</p>
        {preview.warnings.length > 0 && (
          <div className="bundle-warnings">
            {preview.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        )}
        <label className="catalog-check bundle-confirm">
          <input
            type="checkbox"
            checked={legacyImportConfirmed}
            onChange={(event) => setLegacyImportConfirmed(event.target.checked)}
          />
          Add converted records to DeKoi
        </label>
      </div>
    );
  }

  function renderStorageRepairCollections() {
    if (!storageRepairStatus || storageRepairStatus.collections.length === 0) {
      return null;
    }

    const storageActionBusy =
      storageReloadBusy ||
      storageRepairBusy !== null ||
      nav.messengerStorageStatus === "loading" ||
      nav.messengerStorageStatus === "saving";

    return (
      <div className="storage-repair-list" aria-live="polite">
        {storageRepairStatus.collections.map((collection) => {
          const restoreConfirmed = storageRepairConfirmationMatches(
            collection,
            "restore-backup",
          );
          const replaceConfirmed = storageRepairConfirmationMatches(
            collection,
            "replace-empty",
          );
          const finishConfirmed = storageRepairConfirmationMatches(
            collection,
            "finish-repair",
          );
          const busyForCollection =
            storageRepairBusy?.startsWith(`${collection.entity}:`) ?? false;

          return (
            <article
              className={`storage-repair-row${
                collection.error ? " error" : ""
              }`}
              key={collection.entity}
            >
              <div className="storage-repair-copy">
                <b>{collection.label}</b>
                <span>{collection.error ?? "Pre-repair copy is saved."}</span>
                <div
                  className="storage-repair-flags"
                  aria-label={`${collection.label} recovery artifacts`}
                >
                  <span className={collection.backupExists ? "on" : ""}>
                    Backup
                  </span>
                  <span className={collection.preRepairExists ? "on" : ""}>
                    Pre-repair
                  </span>
                  {collection.temporaryExists && <span className="on">Temp</span>}
                </div>
              </div>

              <div className="runtime-actions storage-repair-actions">
                {collection.known && collection.repairable && (
                  <>
                    <button
                      type="button"
                      disabled={
                        storageActionBusy || !collection.canRestoreBackup
                      }
                      onClick={() =>
                        handleStorageRepair(collection, "restore-backup")
                      }
                    >
                      {restoreConfirmed ? "Confirm restore" : "Restore backup"}
                    </button>
                    {!collection.canRestoreBackup && (
                      <button
                        type="button"
                        className="care-btn danger"
                        disabled={storageActionBusy}
                        onClick={() =>
                          handleStorageRepair(collection, "replace-empty")
                        }
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
                    onClick={() => handleStorageRepairFinish(collection)}
                  >
                    {finishConfirmed ? "Confirm finish" : "Finish repair"}
                  </button>
                )}
              </div>

              {busyForCollection && (
                <p className="bundle-note">Working on {collection.label}...</p>
              )}
              {!collection.known && (
                <p className="bundle-note">
                  Update DeKoi before repairing this collection in the app.
                </p>
              )}
              {collection.known &&
                collection.repairable &&
                !collection.canRestoreBackup && (
                  <p className="bundle-note">
                    {collection.backupExists
                      ? "Backup file exists but cannot be restored."
                      : "No backup file is available for restore."}
                  </p>
                )}
              {collection.known &&
                collection.repairable &&
                collection.canRestoreBackup && (
                  <p className="bundle-note">
                    Backup restore is available. Empty replacement is hidden.
                  </p>
                )}
              {collection.temporaryExists && (
                <p className="bundle-note">
                  Temp is a leftover write scratch file. Repair works from the
                  live file and backup.
                </p>
              )}
            </article>
          );
        })}
      </div>
    );
  }

  function renderStockingTools() {
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
            <button
              type="button"
              className="care-btn primary"
              onClick={handleBundleExport}
            >
              Export JSON
            </button>
          </div>
          {renderBundleCounts(currentBundleCounts)}
          <div className="runtime-actions">
            <button
              type="button"
              disabled={desktopFileBusy}
              onClick={handleDesktopBundleExport}
            >
              Export desktop file
            </button>
          </div>
          <p className="bundle-note">
            Remote Runtime URL is not included. Saved connection fields,
            excluding provider secrets, are included in exports.
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
              onChange={handleBundleFileChange}
            />
            <div className="help">
              Import previews counts before anything is changed.
            </div>
          </div>

          <div className="runtime-actions">
            <button
              type="button"
              disabled={desktopFileBusy}
              onClick={handleDesktopBundleFileImport}
            >
              Open desktop file
            </button>
          </div>

          {bundlePreview && (
            <div className="bundle-preview">
              <b>Import preview</b>
              {renderBundleCounts(bundlePreview.counts)}
              {bundlePreview.warnings.length > 0 && (
                <div className="bundle-warnings">
                  {bundlePreview.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
              <label className="catalog-check bundle-confirm">
                <input
                  type="checkbox"
                  checked={bundleReplaceConfirmed}
                  onChange={(event) =>
                    setBundleReplaceConfirmed(event.target.checked)
                  }
                />
                Replace current DeKoi records with this bundle
              </label>
            </div>
          )}

          {bundleStatus && <p className="bundle-status">{bundleStatus}</p>}
          {storageImportFailureSource === "bundle" && (
            <div className="runtime-actions">
              <button type="button" onClick={acknowledgeStorageImportFailure}>
                Acknowledge import failure
              </button>
            </div>
          )}

          <div className="runtime-actions">
            <button
              type="button"
              className="care-btn primary"
              disabled={
                !bundlePreview || !bundleReplaceConfirmed || bundleImportBusy
              }
              onClick={handleBundleImport}
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
              onChange={handleLegacyFileChange}
            />
            <div className="help">
              Supports previous thread export files. Converted records are added
              as native Messenger threads.
            </div>
          </div>

          {legacyPreview && renderLegacyPreview(legacyPreview)}
          {legacyStatus && <p className="bundle-status">{legacyStatus}</p>}
          {storageImportFailureSource === "legacy" && (
            <div className="runtime-actions">
              <button type="button" onClick={acknowledgeStorageImportFailure}>
                Acknowledge import failure
              </button>
            </div>
          )}

          <div className="runtime-actions">
            <button
              type="button"
              className="care-btn primary"
              disabled={
                !legacyPreview || !legacyImportConfirmed || legacyImportBusy
              }
              onClick={handleLegacyImport}
            >
              {legacyImportBusy
                ? "Importing records"
                : "Import converted records"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <aside
      className={`care${open ? " open" : ""}`}
      aria-label="Settings"
      aria-hidden={open ? undefined : true}
    >
      <div className="care-head">
        <div className="top">
          <h2>Settings</h2>
          <div
            className="x"
            role="button"
            tabIndex={0}
            aria-label="Close Settings"
            onClick={handleCareClose}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCareClose();
              }
            }}
          >
            ✕
          </div>
        </div>
      </div>

      <div className="care-tabs">
        {CARE_TABS.map((tab, i) => (
          <div
            key={tab.label}
            className={`ctab${nav.careTab === i ? " on" : ""}`}
            role="tab"
            tabIndex={0}
            aria-selected={nav.careTab === i}
            onClick={() => nav.setCareTab(i)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                nav.setCareTab(i);
              }
            }}
          >
            {tab.label} <small>{tab.hint}</small>
          </div>
        ))}
      </div>

      <div className="care-body">
        {nav.careTab === 0 ? (
          <>
            <p className="care-intro">
              Language and regional preferences for the whole pond.
            </p>

            <div className="field">
              <label htmlFor="care-language">Language</label>
              <select className="pondsel" id="care-language">
                <option>English</option>
              </select>
              <div className="help">
                English is the only bundled language for now. New languages will
                surface here as they're stocked — without disturbing your
                layout.
              </div>
            </div>
          </>
        ) : nav.careTab === 1 ? (
          <>
            <p className="care-intro">
              Change how the pond looks. Changes apply instantly.
            </p>

            <SettingSection title="Accent">
              <Chip
                options={[
                  { value: "koi", label: "Koi" },
                  { value: "jade", label: "Jade" },
                  { value: "amber", label: "Amber" },
                ]}
                value={accent}
                onChange={(v) =>
                  nav.updateAppSettings({
                    accent: v as "koi" | "jade" | "amber",
                  })
                }
                ariaLabel="Accent color"
              />
            </SettingSection>

            <SettingSection title="Motion">
              <Seg
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "reduced", label: "Reduced" },
                  { value: "off", label: "Off" },
                ]}
                value={motion}
                onChange={(v) =>
                  nav.updateAppSettings({
                    motion: v as "auto" | "reduced" | "off",
                  })
                }
                ariaLabel="Motion preference"
              />
              <div className="help" style={{ marginTop: 0 }}>
                Auto follows your system&rsquo;s reduced-motion setting.
              </div>
            </SettingSection>

            <SettingSection title="Density">
              <Seg
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
                value={density}
                onChange={(v) =>
                  nav.updateAppSettings({
                    density: v as "comfortable" | "compact",
                  })
                }
                ariaLabel="Density preference"
              />
            </SettingSection>

            <SettingSection title="Text size">
              <Slider
                value={fontScale}
                onChange={(v) => nav.updateAppSettings({ fontScale: v })}
                ariaLabel="Text size"
                min={90}
                max={120}
                step={5}
              />
              <div className="track-ends">
                <span>Small</span>
                <span>Large</span>
              </div>
            </SettingSection>
          </>
        ) : nav.careTab === 2 ? (
          <>
            <p className="care-intro">How the pond responds to your touch.</p>

            <div className="toggle-row">
              <div className="tl">
                <b>Let replies ripple in</b>
                <i>stream responses word by word</i>
              </div>
              <Switch
                checked={streamReplies}
                onChange={(v) => nav.updateAppSettings({ streamReplies: v })}
                ariaLabel="Let replies ripple in"
              />
            </div>

            <div className="slider-field">
              <div className="sl-top">
                <b>Ripple speed</b>
                <span>{rippleSpeed}</span>
              </div>
              <Slider
                value={rippleSpeed}
                onChange={(v) => nav.updateAppSettings({ rippleSpeed: v })}
                ariaLabel="Ripple speed"
              />
              <div className="track-ends">
                <span>Still</span>
                <span>Rushing</span>
              </div>
            </div>

            <div className="toggle-row">
              <div className="tl">
                <b>Surface all text at once</b>
                <i>skip the reveal, show it all</i>
              </div>
              <Switch
                checked={surfaceAllText}
                onChange={(v) => nav.updateAppSettings({ surfaceAllText: v })}
                ariaLabel="Surface all text at once"
              />
            </div>
            <div className="toggle-row">
              <div className="tl">
                <b>Wheel + click to navigate</b>
                <i>scroll through the depths</i>
              </div>
              <Switch
                checked={wheelNavigate}
                onChange={(v) => nav.updateAppSettings({ wheelNavigate: v })}
                ariaLabel="Wheel + click to navigate"
              />
            </div>

            <div className="slider-field">
              <div className="sl-top">
                <b>Narration drift</b>
                <span>{narrationDrift}</span>
              </div>
              <Slider
                value={narrationDrift}
                onChange={(v) => nav.updateAppSettings({ narrationDrift: v })}
                ariaLabel="Narration drift"
              />
              <div className="track-ends">
                <span>Still</span>
                <span>Rushing</span>
              </div>
            </div>

            <div className="slider-field">
              <div className="sl-top">
                <b>Auto-play pause between segments</b>
                <span>{(autoplayPause / 10).toFixed(1)}s</span>
              </div>
              <Slider
                value={autoplayPause}
                onChange={(v) => nav.updateAppSettings({ autoplayPause: v })}
                ariaLabel="Auto-play pause between segments"
              />
              <div className="track-ends">
                <span>Short</span>
                <span>Long</span>
              </div>
            </div>

            <div className="field">
              <label>Send on Enter</label>
              <div className="help" style={{ marginTop: 0, marginBottom: 10 }}>
                Choose which surface sends when you press Enter.
              </div>
              <Seg
                options={SEND_ON_ENTER_SURFACES}
                value={nav.appSettings.sendOnEnterSurface}
                onChange={nav.setSendOnEnterSurface}
                ariaLabel="Send on Enter surface"
              />
            </div>

            <div className="toggle-row" style={{ borderBottom: "none" }}>
              <div className="tl">
                <b>Ask before releasing a koi</b>
                <i>confirm before deleting</i>
              </div>
              <Switch
                checked={nav.appSettings.confirmRelease}
                onChange={nav.setConfirmRelease}
                ariaLabel="Ask before releasing a koi"
              />
            </div>
          </>
        ) : nav.careTab === 3 ? (
          <>
            <p className="care-intro">
              Default generation parameters for new threads.
            </p>

            <SettingSection
              title="Generation"
              description="Global defaults for model output"
            >
              <div className="slider-field">
                <div className="sl-top">
                  <b>Temperature</b>
                  <span>{(defaultTemperature / 100).toFixed(2)}</span>
                </div>
                <Slider
                  value={defaultTemperature}
                  onChange={(v) =>
                    nav.updateAppSettings({ defaultTemperature: v })
                  }
                  min={0}
                  max={200}
                  step={5}
                  ariaLabel="Temperature"
                />
                <div className="track-ends">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Max tokens</b>
                  <span>{defaultMaxTokens}</span>
                </div>
                <NumberField
                  value={defaultMaxTokens}
                  onChange={(v) =>
                    nav.updateAppSettings({ defaultMaxTokens: v })
                  }
                  min={64}
                  max={8192}
                  step={64}
                  ariaLabel="Max tokens"
                />
              </div>

              <div className="slider-field">
                <div className="sl-top">
                  <b>Top-p</b>
                  <span>{(defaultTopP / 100).toFixed(2)}</span>
                </div>
                <Slider
                  value={defaultTopP}
                  onChange={(v) => nav.updateAppSettings({ defaultTopP: v })}
                  min={0}
                  max={100}
                  step={1}
                  ariaLabel="Top-p"
                />
                <div className="track-ends">
                  <span>Focused</span>
                  <span>Diverse</span>
                </div>
              </div>
            </SettingSection>

            <p
              style={{
                color: "var(--mist-dim)",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              These are global defaults. You can override them per thread in the
              messenger.
            </p>
          </>
        ) : (
          <>
            <form className="runtime-panel" onSubmit={handleRuntimeSubmit}>
              <div className="field">
                <label htmlFor="remote-runtime-url">Remote Runtime URL</label>
                <input
                  className="pondinput"
                  id="remote-runtime-url"
                  type="url"
                  placeholder="http://127.0.0.1:7341 or desktop://runtime"
                  value={runtimeUrl}
                  onChange={(event) => setRuntimeUrl(event.target.value)}
                />
                <div className="help">
                  Later profile and save-data sync will use this host. Leave
                  empty for desktop host storage inside Tauri.
                </div>
              </div>

              <div className={`runtime-status ${nav.messengerStorageStatus}`}>
                <b>
                  {nav.messengerStorageMode === "remote"
                    ? "Remote runtime"
                    : nav.messengerStorageMode === "desktop"
                      ? "Desktop host"
                      : "Storage unavailable"}
                </b>
                <span>{runtimeStatusMessage}</span>
              </div>

              <div className="runtime-status">
                <b>
                  {desktopHostStatus?.hostKind === "tauri"
                    ? "Desktop host"
                    : "Browser host"}
                </b>
                <span>
                  {desktopHostStatus?.message ??
                    "Check whether native host capabilities are available."}
                </span>
              </div>

              {desktopHostStatus && (
                <div className="host-flags" aria-label="Desktop host readiness">
                  <span className={desktopHostStatus.storageReady ? "on" : ""}>
                    Storage
                  </span>
                  <span className={desktopHostStatus.runtimeReady ? "on" : ""}>
                    Runtime
                  </span>
                </div>
              )}

              <div className="runtime-actions">
                <button type="submit" className="care-btn primary">
                  Apply
                </button>
                <button type="button" onClick={handleRuntimeTest}>
                  Test
                </button>
                <button type="button" onClick={handleUseLocalStorage}>
                  Use host default
                </button>
                <button type="button" onClick={handleUseDesktopRuntime}>
                  Use desktop
                </button>
                <button
                  type="button"
                  disabled={desktopHostBusy}
                  onClick={handleDesktopHostCheck}
                >
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
                <button
                  type="button"
                  disabled={storageReloadBusy}
                  onClick={handleStorageStaleCheck}
                >
                  {storageReloadBusy ? "Checking files" : "Check files"}
                </button>
                <button
                  type="button"
                  className="care-btn primary"
                  disabled={storageReloadBusy}
                  onClick={handleStorageReload}
                >
                  {storageReloadBusy ? "Reloading records" : "Reload records"}
                </button>
              </div>

              {nav.storageHasUnsavedChanges && (
                <p className="bundle-note">
                  Storage has local changes or pending saves.
                </p>
              )}
              {storageReloadStatus && (
                <p className="bundle-status">{storageReloadStatus}</p>
              )}
              {renderStorageRepairCollections()}
            </section>

            <hr className="care-divider" />
            {renderStockingTools()}

            <div className="runtime-actions">
              <button
                type="button"
                className="care-btn primary"
                disabled={desktopStorageBusy}
                onClick={handleDesktopStorageSave}
              >
                Save host bundle
              </button>
              <button
                type="button"
                disabled={desktopStorageBusy}
                onClick={handleDesktopStorageLoad}
              >
                Load host bundle
              </button>
            </div>

            {desktopStorageStatus && (
              <p className="bundle-status">{desktopStorageStatus}</p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
