import { useCallback } from "react";
import type { SurfaceId } from "../../../engine/surfaces";
import { MESSENGER } from "../../../engine/surfaces";
import { attachMessengerMessagesToThreads } from "../../../engine/messenger";
import { attachRoleplayEntriesToThreads } from "../../../engine/roleplay";
import { createRecordId } from "../../../shared/browser/record-id";
import {
  type AppStorageRecords,
  type AppStorageReplaceResult,
} from "../../runtime";
import {
  createDeKoiStorageBundle,
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
  ) => Promise<AppStorageReplaceResult>;
};

export function useAppImportExportActions({
  appSettings,
  characters,
  personas,
  lorebooks,
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
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    async (bundle: DeKoiStorageBundle) => {
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
        (connection) =>
          connection.id === importedSettings.activeMessengerConnectionId,
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
        providerConnections: importedConnections,
        roleplayThreads: importedRoleplayThreads,
        messengerThreads: importedMessengerThreads,
        rippleStates: bundle.data.rippleStates,
      };

      const storageResult = await commitAppStorageImport(importedRecords);

      if (storageResult.status !== "ready") {
        return storageResult;
      }

      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
      return storageResult;
    },
    [
      commitAppStorageImport,
      setSelectedSurface,
      setView,
    ],
  );

  const importLegacyData = useCallback(
    async (data: DeKoiLegacyImportData) => {
      const importedThreads = data.messengerThreads.map((thread) => {
        const id = createRecordId("messenger-thread");
        return {
          ...thread,
          id,
          messages: thread.messages.map((message) => ({
            ...message,
            threadId: id,
          })),
        };
      });
      const firstImportedThreadId = importedThreads[0]?.id ?? null;

      const importedRecords: AppStorageRecords = {
        appSettings,
        characters,
        personas,
        lorebooks,
        providerConnections,
        roleplayThreads,
        messengerThreads: [...importedThreads, ...messengerThreads],
        rippleStates,
      };

      const storageResult = await commitAppStorageImport(importedRecords);
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
