import { useCallback } from "react";
import type { ClassicThread } from "../../../engine/classic";
import { replaceClassicThreadProviderConnection } from "../../../engine/classic-actions";
import type { MessengerThread } from "../../../engine/messenger";
import { replaceMessengerThreadProviderConnection } from "../../../engine/messenger-actions";
import type { ProviderConnectionRecord } from "../../../engine/provider-connection";
import {
  createProviderConnectionRecord,
  deleteProviderConnectionRecord,
  duplicateProviderConnectionRecord,
  updateProviderConnectionRecord,
  type ProviderConnectionInput,
} from "../../../engine/provider-connection-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import type { AppSettings } from "../../../engine/app-settings";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseProviderConnectionActionsInput = {
  providerConnections: ProviderConnectionRecord[];
  setProviderConnections: StateSetter<ProviderConnectionRecord[]>;
  setAppSettings: StateSetter<AppSettings>;
  setClassicThreads: StateSetter<ClassicThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

export function useProviderConnectionActions({
  providerConnections,
  setProviderConnections,
  setAppSettings,
  setClassicThreads,
  setMessengerThreads,
}: UseProviderConnectionActionsInput) {
  const createProviderConnection = useCallback(
    (input: ProviderConnectionInput) => {
      const now = currentIsoTimestamp();
      const connection = createProviderConnectionRecord({
        id: createRecordId("connection"),
        input,
        now,
      });
      setProviderConnections((currentConnections) => [
        connection,
        ...currentConnections,
      ]);
      return connection;
    },
    [setProviderConnections],
  );

  const updateProviderConnection = useCallback(
    (connectionId: string, input: ProviderConnectionInput) => {
      const now = currentIsoTimestamp();
      setProviderConnections((currentConnections) =>
        currentConnections.map((connection) =>
          connection.id === connectionId
            ? updateProviderConnectionRecord(connection, input, now)
            : connection,
        ),
      );
    },
    [setProviderConnections],
  );

  const duplicateProviderConnection = useCallback(
    (connectionId: string) => {
      const connection = providerConnections.find(
        (currentConnection) => currentConnection.id === connectionId,
      );
      if (!connection) return null;

      const now = currentIsoTimestamp();
      const duplicatedConnection = duplicateProviderConnectionRecord(
        connection,
        createRecordId("connection"),
        now,
      );
      setProviderConnections((currentConnections) => [
        duplicatedConnection,
        ...currentConnections,
      ]);
      return duplicatedConnection;
    },
    [providerConnections, setProviderConnections],
  );

  const deleteProviderConnection = useCallback(
    (connectionId: string) => {
      if (providerConnections.length <= 1) return;

      const nextConnections = deleteProviderConnectionRecord(
        providerConnections,
        connectionId,
      );
      if (nextConnections.length === providerConnections.length) return;

      const fallbackConnection = nextConnections[0];
      const now = currentIsoTimestamp();
      setProviderConnections(nextConnections);
      setAppSettings((currentSettings) =>
        currentSettings.activeMessengerConnectionId === connectionId
          ? {
              ...currentSettings,
              activeMessengerConnectionId: fallbackConnection.id,
            }
          : currentSettings,
      );
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          replaceMessengerThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection.id,
            now,
          ),
        ),
      );
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          replaceClassicThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection.id,
            now,
          ),
        ),
      );
    },
    [
      providerConnections,
      setAppSettings,
      setClassicThreads,
      setMessengerThreads,
      setProviderConnections,
    ],
  );

  return {
    createProviderConnection,
    updateProviderConnection,
    duplicateProviderConnection,
    deleteProviderConnection,
  };
}
