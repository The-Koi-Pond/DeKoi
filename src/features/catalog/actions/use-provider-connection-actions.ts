import { useCallback } from "react";
import type { RoleplayThread } from "../../../engine/contracts/types/roleplay";
import { replaceRoleplayThreadProviderConnection } from "../../../engine/modes/roleplay/roleplay-actions";
import type { MessengerThread } from "../../../engine/contracts/types/messenger";
import { replaceMessengerThreadProviderConnection } from "../../../engine/modes/messenger/messenger-actions";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { getProviderConnectionProviderOption } from "../../../engine/contracts/types/provider-connection";
import {
  createProviderConnectionRecord,
  deleteProviderConnectionRecord,
  duplicateProviderConnectionRecord,
  updateProviderConnectionRecord,
  type ProviderConnectionInput,
} from "../../../engine/catalog/provider-connection-actions";
import { currentIsoTimestamp } from "../../../shared/browser/current-time";
import { createRecordId } from "../../../shared/browser/record-id";
import { isDesktopHostAvailable } from "../../../shared/api/desktop-host-common";
import {
  deleteDesktopProviderSecret,
  writeDesktopProviderSecret,
} from "../../../shared/api/desktop-provider-secrets";
import type { AppSettings } from "../../../engine/contracts/types/app-settings";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseProviderConnectionActionsInput = {
  providerConnections: ProviderConnectionRecord[];
  setProviderConnections: StateSetter<ProviderConnectionRecord[]>;
  setAppSettings: StateSetter<AppSettings>;
  setRoleplayThreads: StateSetter<RoleplayThread[]>;
  setMessengerThreads: StateSetter<MessengerThread[]>;
};

function providerSecretInput(input: ProviderConnectionInput) {
  return input.apiKey?.trim() ?? "";
}

function normalizedConnectionEndpoint(input: ProviderConnectionInput) {
  return input.baseUrl?.trim().replace(/\/+$/, "") ?? "";
}

async function writeProviderSecretIfNeeded(
  connectionId: string,
  input: ProviderConnectionInput,
) {
  const secret = providerSecretInput(input);
  if (!secret) return false;

  if (!isDesktopHostAvailable()) {
    throw new Error(
      "Provider keys can only be saved by the desktop app in this version.",
    );
  }

  await writeDesktopProviderSecret(connectionId, secret, {
    provider: input.provider,
    baseUrl: input.baseUrl,
  });
  return true;
}

export function useProviderConnectionActions({
  providerConnections,
  setProviderConnections,
  setAppSettings,
  setRoleplayThreads,
  setMessengerThreads,
}: UseProviderConnectionActionsInput) {
  const createProviderConnection = useCallback(
    async (input: ProviderConnectionInput) => {
      const now = currentIsoTimestamp();
      const id = createRecordId("connection");
      const hasSecret = await writeProviderSecretIfNeeded(id, input);
      const connection = createProviderConnectionRecord({
        id,
        input: { ...input, hasSecret },
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
    async (connectionId: string, input: ProviderConnectionInput) => {
      const now = currentIsoTimestamp();
      const existingConnection = providerConnections.find(
        (connection) => connection.id === connectionId,
      );
      const existingProvider = getProviderConnectionProviderOption(
        existingConnection?.provider,
      );
      const keepsExistingSecretScope =
        existingConnection?.provider === input.provider &&
        existingConnection.baseUrl.trim().replace(/\/+$/, "") ===
          normalizedConnectionEndpoint(input);
      const hasNewSecret = await writeProviderSecretIfNeeded(
        connectionId,
        input,
      );
      const hasSecret =
        hasNewSecret ||
        (keepsExistingSecretScope &&
          existingProvider.apiKeyRequired &&
          existingConnection?.status === "ready");
      if (
        existingConnection &&
        existingConnection.status === "ready" &&
        !hasNewSecret &&
        !keepsExistingSecretScope &&
        isDesktopHostAvailable()
      ) {
        await deleteDesktopProviderSecret(connectionId);
      }
      setProviderConnections((currentConnections) =>
        currentConnections.map((connection) =>
          connection.id === connectionId
            ? updateProviderConnectionRecord(
                connection,
                { ...input, hasSecret },
                now,
              )
            : connection,
        ),
      );
    },
    [providerConnections, setProviderConnections],
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
    async (connectionId: string) => {
      if (isDesktopHostAvailable()) {
        await deleteDesktopProviderSecret(connectionId);
      }

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
              activeMessengerConnectionId: fallbackConnection?.id ?? "",
            }
          : currentSettings,
      );
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          replaceMessengerThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection?.id ?? null,
            now,
          ),
        ),
      );
      setRoleplayThreads((currentThreads) =>
        currentThreads.map((thread) =>
          replaceRoleplayThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection?.id ?? null,
            now,
          ),
        ),
      );
    },
    [
      providerConnections,
      setAppSettings,
      setRoleplayThreads,
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
