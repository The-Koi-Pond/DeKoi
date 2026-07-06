import { useState } from "react";
import {
  finishAppStorageCollectionRepair,
  loadAppStorageRepairStatus,
  repairAppStorageCollection,
  summarizeAppStorageDroppedRecords,
  type AppStorageRepairCollectionStatus,
  type AppStorageRepairStatusResult,
  type AppStorageRepairStrategy,
} from "../../runtime";
import type { NavStorageActions, NavStorageState } from "../../navigation";
import {
  checkDesktopHostStatus,
  type DeKoiDesktopHostStatus,
} from "../../../shared/api/desktop-host-status";
import { checkRemoteRuntimeHealth } from "../../../shared/api/remote-runtime";
import type { StorageRepairActionState } from "./care-drawer-types";

type CareRuntimeStorageNav = Pick<NavStorageActions, "checkAppStorageStale" | "reloadAppStorage"> &
  Pick<
    NavStorageState,
    | "droppedRecordCountByCollection"
    | "messengerStorageMessage"
    | "messengerStorageStatus"
    | "remoteRuntimeUrl"
  >;

export function useCareRuntimeStorageController(nav: CareRuntimeStorageNav) {
  const [runtimeUrl, setRuntimeUrl] = useState(nav.remoteRuntimeUrl);
  const [runtimeHealth, setRuntimeHealth] = useState("");
  const [desktopHostStatus, setDesktopHostStatus] = useState<DeKoiDesktopHostStatus | null>(null);
  const [desktopHostBusy, setDesktopHostBusy] = useState(false);
  const [storageReloadBusy, setStorageReloadBusy] = useState(false);
  const [storageReloadStatus, setStorageReloadStatus] = useState("");
  const [storageRepairStatus, setStorageRepairStatus] =
    useState<AppStorageRepairStatusResult | null>(null);
  const [storageRepairBusy, setStorageRepairBusy] = useState<StorageRepairActionState | null>(null);
  const [storageRepairConfirmation, setStorageRepairConfirmation] =
    useState<StorageRepairActionState | null>(null);
  const runtimeStatusMessage = runtimeHealth || nav.messengerStorageMessage;
  const droppedRecordsSummary = summarizeAppStorageDroppedRecords(
    nav.droppedRecordCountByCollection,
  );
  const storageActionBusy =
    storageReloadBusy ||
    storageRepairBusy !== null ||
    nav.messengerStorageStatus === "loading" ||
    nav.messengerStorageStatus === "saving";

  async function handleRuntimeTest() {
    setRuntimeHealth("Checking remote runtime...");
    const health = await checkRemoteRuntimeHealth(runtimeUrl);
    setRuntimeHealth(health.message);
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

  async function refreshDesktopHostStatus() {
    const status = await checkDesktopHostStatus();
    setDesktopHostStatus(status);
    return status;
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
    return status.collections.find((item) => item.entity === collection.entity);
  }

  function formatRepairConfirmationProblem(
    collection: AppStorageRepairCollectionStatus,
    status: AppStorageRepairStatusResult,
  ) {
    const current = findStorageRepairStatus(status, collection);
    if (!current) return "";

    return current.error ? ` ${current.error}` : ` ${current.label} still has repair work pending.`;
  }

  async function handleStorageStaleCheck() {
    setStorageReloadBusy(true);
    setStorageReloadStatus("Checking stored collections...");

    try {
      const result = await nav.checkAppStorageStale();
      const repairStatus = await refreshStorageRepairStatus();
      const changedCount = result.changedCollectionKeys.length;
      const repairMessage = repairStatus.collections.length > 0 ? ` ${repairStatus.message}` : "";
      const statusMessage =
        result.stale && changedCount > 0
          ? `${result.message} ${changedCount} collection(s) changed.`
          : result.message;
      setStorageReloadStatus(`${statusMessage}${repairMessage}`);
    } catch (error) {
      setStorageReloadStatus(error instanceof Error ? error.message : String(error));
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
      const repairMessage = repairStatus.collections.length > 0 ? ` ${repairStatus.message}` : "";
      setStorageReloadStatus(`${result.message}${repairMessage}`);
    } catch (error) {
      setStorageReloadStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setStorageReloadBusy(false);
    }
  }

  async function handleStorageRepair(
    collection: AppStorageRepairCollectionStatus,
    strategy: AppStorageRepairStrategy,
  ) {
    if (!collection.known) {
      setStorageReloadStatus(`${collection.label} cannot be repaired by this app version.`);
      return;
    }

    const action = { entity: collection.entity, action: strategy };
    if (!storageRepairActionMatches(storageRepairConfirmation, action)) {
      setStorageRepairConfirmation(action);
      setStorageReloadStatus(
        strategy === "restore-backup"
          ? `Select Restore backup again to repair ${collection.label}.`
          : `Select Replace empty again to erase and repair ${collection.label}.`,
      );
      return;
    }

    setStorageRepairBusy(action);
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
      const postRepairStatus = findStorageRepairStatus(repairStatus, collection);
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

      const confirmedTargetStatus = findStorageRepairStatus(confirmedRepairStatus, collection);
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
      setStorageReloadStatus(`${result.message} ${reloadResult.message}${finishMessage}`);
    } catch (error) {
      setStorageReloadStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setStorageRepairBusy(null);
    }
  }

  async function handleStorageRepairFinish(collection: AppStorageRepairCollectionStatus) {
    if (!collection.known) {
      setStorageReloadStatus(`${collection.label} cannot be finished by this app version.`);
      return;
    }

    const action = { entity: collection.entity, action: "finish-repair" as const };
    if (!storageRepairActionMatches(storageRepairConfirmation, action)) {
      setStorageRepairConfirmation(action);
      setStorageReloadStatus(
        `Select Finish repair again to clear the pre-repair copy for ${collection.label}.`,
      );
      return;
    }

    setStorageRepairBusy(action);
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
      setStorageReloadStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setStorageRepairBusy(null);
    }
  }

  return {
    runtimeUrl,
    runtimeStatusMessage,
    desktopHostStatus,
    desktopHostBusy,
    storageReloadBusy,
    droppedRecordsSummary,
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
  };
}

function storageRepairActionMatches(
  current: StorageRepairActionState | null,
  expected: StorageRepairActionState,
) {
  return current?.entity === expected.entity && current.action === expected.action;
}
