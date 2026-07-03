import { useCallback } from "react";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import { MESSENGER } from "../../../engine/contracts/constants/surfaces";
import { DEFAULT_APP_SETTINGS } from "../../../engine/contracts/types/app-settings";
import { attachMessengerMessagesToThreads } from "../../../engine/contracts/types/messenger";
import { attachRoleplayEntriesToThreads } from "../../../engine/contracts/types/roleplay";
import { createRecordId } from "../../../shared/browser/record-id";
import {
  APP_STORAGE_COLLECTION_KEYS,
  appStorageCollectionCount,
  type AppStorageRecords,
  type AppStorageReplaceResult,
} from "../../runtime";
import {
  createDeKoiStorageBundle,
  createDeKoiStorageBundleFingerprint,
  type DeKoiLegacyImportData,
  type DeKoiStorageBundle,
} from "../../runtime";
import type { PondView } from "../../navigation";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseAppImportExportActionsInput = AppStorageRecords & {
  providerConnections: AppStorageRecords["providerConnections"];
  setSelectedSurface: StateSetter<SurfaceId>;
  setView: (view: PondView) => void;
  commitAppStorageImport: (
    records: AppStorageRecords,
    options?: { desktopBackupPath?: string | null },
  ) => Promise<AppStorageReplaceResult>;
};

type ImportCommitOptions = {
  previewFingerprint: string;
  desktopBackupPath?: string | null;
};

function createImportActionErrorResult(
  records: AppStorageRecords,
  message: string,
): AppStorageReplaceResult {
  return {
    mode: "unavailable",
    status: "error",
    message,
    counts: Object.fromEntries(
      APP_STORAGE_COLLECTION_KEYS.map((collectionKey) => [
        collectionKey,
        appStorageCollectionCount(records, collectionKey),
      ]),
    ) as AppStorageReplaceResult["counts"],
    collections: [],
    failedCollectionKey: null,
    requiresReload: false,
    rollbackAvailable: false,
    rollbackMessage:
      "No automatic rollback was performed. Use the pre-import backup bundle to restore if needed.",
    storageMetadata: {},
  };
}

export function prepareLegacyImportData(data: DeKoiLegacyImportData): DeKoiLegacyImportData {
  return {
    ...data,
    messengerThreads: data.messengerThreads.map((thread) => {
      const id = createRecordId("messenger-thread");
      return {
        ...thread,
        id,
        messages: thread.messages.map((message) => ({
          ...message,
          threadId: id,
        })),
      };
    }),
  };
}

export function createLegacyImportDataFingerprint(data: DeKoiLegacyImportData) {
  return createDeKoiStorageBundleFingerprint(
    createDeKoiStorageBundle({
      appSettings: DEFAULT_APP_SETTINGS,
      characters: [],
      roleplayThreads: [],
      personas: [],
      lorebooks: [],
      loreRuntimeStates: [],
      providerConnections: [],
      messengerThreads: data.messengerThreads,
      rippleStates: [],
    }),
  );
}

export function useAppImportExportActions({
  appSettings,
  characters,
  personas,
  lorebooks,
  loreRuntimeStates,
  providerConnections,
  roleplayThreads,
  messengerThreads,
  rippleStates,
  setSelectedSurface,
  setView,
  commitAppStorageImport,
}: UseAppImportExportActionsInput) {
  const createStorageBundle = useCallback(
    () =>
      createDeKoiStorageBundle({
        appSettings,
        characters,
        roleplayThreads,
        lorebooks,
        loreRuntimeStates,
        messengerThreads,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      roleplayThreads,
      lorebooks,
      loreRuntimeStates,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    async (bundle: DeKoiStorageBundle, options: ImportCommitOptions) => {
      const importedConnections = bundle.data.providerConnections;
      const importedRoleplayThreads = attachRoleplayEntriesToThreads(
        bundle.data.roleplayThreads,
        bundle.data.roleplayEntries,
      );
      const importedMessengerThreads = attachMessengerMessagesToThreads(
        bundle.data.messengerThreads,
        bundle.data.messengerMessages,
      );
      const importedSettings = { ...bundle.data.appSettings };
      const hasActiveConnection = importedConnections.some(
        (connection) => connection.id === importedSettings.activeMessengerConnectionId,
      );
      const fallbackConnection = importedConnections[0] ?? null;

      if (!hasActiveConnection && fallbackConnection) {
        importedSettings.activeMessengerConnectionId = fallbackConnection.id;
      } else if (!hasActiveConnection) {
        importedSettings.activeMessengerConnectionId = "";
      }

      const importedRecords: AppStorageRecords = {
        appSettings: importedSettings,
        characters: bundle.data.characters,
        personas: bundle.data.personas,
        lorebooks: bundle.data.lorebooks,
        loreRuntimeStates: bundle.data.loreRuntimeStates,
        providerConnections: importedConnections,
        roleplayThreads: importedRoleplayThreads,
        messengerThreads: importedMessengerThreads,
        rippleStates: bundle.data.rippleStates,
      };

      const actualFingerprint = createDeKoiStorageBundleFingerprint(bundle);
      if (actualFingerprint !== options.previewFingerprint) {
        return createImportActionErrorResult(
          importedRecords,
          "Import preview no longer matches the bundle to commit. Preview the file again before importing.",
        );
      }

      const storageResult = await commitAppStorageImport(importedRecords, {
        desktopBackupPath: options.desktopBackupPath,
      });

      if (storageResult.status !== "ready") {
        return storageResult;
      }

      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
      return storageResult;
    },
    [commitAppStorageImport, setSelectedSurface, setView],
  );

  const importLegacyData = useCallback(
    async (data: DeKoiLegacyImportData, options: ImportCommitOptions) => {
      const firstImportedThreadId = data.messengerThreads[0]?.id ?? null;

      const importedRecords: AppStorageRecords = {
        appSettings,
        characters,
        personas,
        lorebooks,
        loreRuntimeStates,
        providerConnections,
        roleplayThreads,
        messengerThreads: [...data.messengerThreads, ...messengerThreads],
        rippleStates,
      };

      const actualFingerprint = createLegacyImportDataFingerprint(data);
      if (actualFingerprint !== options.previewFingerprint) {
        return createImportActionErrorResult(
          importedRecords,
          "Legacy import preview no longer matches the converted records to commit. Preview the file again before importing.",
        );
      }

      const storageResult = await commitAppStorageImport(importedRecords, {
        desktopBackupPath: options.desktopBackupPath,
      });
      if (storageResult.status !== "ready") return storageResult;

      setSelectedSurface(MESSENGER);
      setView(
        firstImportedThreadId
          ? { kind: "messenger", threadId: firstImportedThreadId }
          : { kind: "pond" },
      );
      return storageResult;
    },
    [
      appSettings,
      characters,
      commitAppStorageImport,
      lorebooks,
      loreRuntimeStates,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
      roleplayThreads,
      setSelectedSurface,
      setView,
    ],
  );

  return {
    createStorageBundle,
    importStorageBundle,
    importLegacyData,
  };
}
