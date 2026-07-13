import { useEffect, type FormEvent } from "react";
import { DESKTOP_RUNTIME_URL } from "../../../shared/api/runtime-target";
import { AppearanceSettingsTab } from "./AppearanceSettingsTab";
import { BehaviorSettingsTab } from "./BehaviorSettingsTab";
import { getCurrentCareBundleCounts } from "./care-current-bundle-counts";
import type { CareDrawerNav } from "./care-drawer-types";
import { CareDrawerShell } from "./CareDrawerShell";
import { DesktopStorageActions } from "./DesktopStorageActions";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { GenerationSettingsTab } from "./GenerationSettingsTab";
import { RuntimeStoragePanel } from "./RuntimeStoragePanel";
import { StockingToolsPanel } from "./StockingToolsPanel";
import { useCareImportExportController } from "./use-care-import-export-controller";
import { useCareRuntimeStorageController } from "./use-care-runtime-storage-controller";
import "./CareDrawer.css";
import "./care-fields.css";
import "../../../shared/ui/primitives/Chip.css";

interface CareDrawerProps {
  nav: CareDrawerNav;
}

export function CareDrawer({ nav }: CareDrawerProps) {
  const open = nav.careOpen;
  const setCareOpen = nav.setCareOpen;
  const setCareTab = nav.setCareTab;

  const currentBundleCounts = getCurrentCareBundleCounts(nav);
  const {
    runtimeUrl,
    runtimeStatusMessage,
    desktopHostStatus,
    desktopHostBusy,
    storageReloadBusy,
    droppedRecordsSummary,
    storageLoadErrors,
    storageReloadStatus,
    storageRepairStatus,
    storageActionBusy,
    storageRepairBusy,
    storageRepairConfirmation,
    setRuntimeUrl,
    setRuntimeHealth,
    handleRuntimeTest,
    handleDesktopHostCheck,
    refreshDesktopHostStatus,
    handleStorageStaleCheck,
    handleStorageReload,
    handleStorageRepair,
    handleStorageRepairFinish,
  } = useCareRuntimeStorageController(nav);
  const {
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
  } = useCareImportExportController({
    nav,
    refreshDesktopHostStatus,
  });

  useEffect(() => {
    if (!storageImportFailureSource || open) return;

    setCareOpen(true);
    setCareTab(4);
  }, [open, setCareOpen, setCareTab, storageImportFailureSource]);

  function handleRuntimeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRuntimeHealth("");
    clearStorageImportRecoveryUi();
    nav.setRemoteRuntimeUrl(runtimeUrl);
  }

  function handleUseLocalStorage() {
    setRuntimeUrl("");
    clearStorageImportRecoveryUi();
    nav.setRemoteRuntimeUrl("");
    setRuntimeHealth(
      "Using desktop host storage when available; otherwise this browser session is temporary.",
    );
  }

  function handleUseDesktopRuntime() {
    setRuntimeUrl(DESKTOP_RUNTIME_URL);
    clearStorageImportRecoveryUi();
    nav.setRemoteRuntimeUrl(DESKTOP_RUNTIME_URL);
    setRuntimeHealth("Desktop runtime selected for storage and profile data.");
  }

  function handleCareClose() {
    if (storageImportFailureSource) {
      setCareOpen(true);
      setCareTab(4);
      showImportFailureCloseRequiredStatus();
      return;
    }

    setCareOpen(false);
  }

  return (
    <CareDrawerShell
      activeTab={nav.careTab}
      open={open}
      onClose={handleCareClose}
      onTabChange={nav.setCareTab}
    >
      {nav.careTab === 0 ? (
        <GeneralSettingsTab />
      ) : nav.careTab === 1 ? (
        <AppearanceSettingsTab
          settings={nav.appSettings}
          updateAppSettings={nav.updateAppSettings}
        />
      ) : nav.careTab === 2 ? (
        <BehaviorSettingsTab
          settings={nav.appSettings}
          updateAppSettings={nav.updateAppSettings}
          setSendOnEnterSurface={nav.setSendOnEnterSurface}
          setConfirmRelease={nav.setConfirmRelease}
        />
      ) : nav.careTab === 3 ? (
        <GenerationSettingsTab
          settings={nav.appSettings}
          lorebooks={nav.lorebooks}
          updateAppSettings={nav.updateAppSettings}
        />
      ) : (
        <>
          <RuntimeStoragePanel
            runtimeUrl={runtimeUrl}
            runtimeStatusMessage={runtimeStatusMessage}
            messengerStorageMode={nav.messengerStorageMode}
            messengerStorageStatus={nav.messengerStorageStatus}
            desktopHostStatus={desktopHostStatus}
            desktopHostBusy={desktopHostBusy}
            storageReloadBusy={storageReloadBusy}
            storageHasUnsavedChanges={nav.storageHasUnsavedChanges}
            droppedRecordsSummary={droppedRecordsSummary}
            storageLoadErrors={storageLoadErrors}
            storageReloadStatus={storageReloadStatus}
            storageRepairStatus={storageRepairStatus}
            storageActionBusy={storageActionBusy}
            storageRepairBusy={storageRepairBusy}
            storageRepairConfirmation={storageRepairConfirmation}
            onRuntimeSubmit={handleRuntimeSubmit}
            onRuntimeUrlChange={setRuntimeUrl}
            onRuntimeTest={handleRuntimeTest}
            onUseLocalStorage={handleUseLocalStorage}
            onUseDesktopRuntime={handleUseDesktopRuntime}
            onDesktopHostCheck={handleDesktopHostCheck}
            onStorageStaleCheck={handleStorageStaleCheck}
            onStorageReload={handleStorageReload}
            onStorageRepair={handleStorageRepair}
            onStorageRepairFinish={handleStorageRepairFinish}
          />

          <hr className="care-divider" />
          <StockingToolsPanel
            currentBundleCounts={currentBundleCounts}
            desktopFileBusy={desktopFileBusy}
            bundlePreview={bundlePreview}
            bundleReplaceConfirmed={bundleReplaceConfirmed}
            bundleStatus={bundleStatus}
            bundleImportBusy={bundleImportBusy}
            legacyPreview={legacyPreview}
            legacyImportConfirmed={legacyImportConfirmed}
            legacyStatus={legacyStatus}
            legacyImportBusy={legacyImportBusy}
            importFailureRecovery={{
              source: storageImportFailureSource,
              restoreAvailable: nav.importRecoveryState.available,
              backupPath: nav.importRecoveryState.desktopBackupPath,
              restoreBusy: storageImportRestoreBusy,
              restoreConfirmed: storageImportRestoreConfirmed,
              onRestore: handleRestorePreImportBackup,
              onAcknowledge: acknowledgeStorageImportFailure,
            }}
            onBundleExport={handleBundleExport}
            onDesktopBundleExport={handleDesktopBundleExport}
            onBundleFileChange={handleBundleFileChange}
            onDesktopBundleFileImport={handleDesktopBundleFileImport}
            onBundleReplaceConfirmedChange={setBundleReplaceConfirmed}
            onBundleImport={handleBundleImport}
            onLegacyFileChange={handleLegacyFileChange}
            onLegacyImportConfirmedChange={setLegacyImportConfirmed}
            onLegacyImport={handleLegacyImport}
          />

          <DesktopStorageActions
            desktopStorageBusy={desktopStorageBusy}
            desktopStorageStatus={desktopStorageStatus}
            onDesktopStorageSave={handleDesktopStorageSave}
            onDesktopStorageLoad={handleDesktopStorageLoad}
          />
        </>
      )}
    </CareDrawerShell>
  );
}
