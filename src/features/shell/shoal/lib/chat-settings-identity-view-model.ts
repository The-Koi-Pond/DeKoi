import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { ChatSettingsThreadRecord } from "./chat-settings-thread-record";

export function getConnectionSettingsViewModel({
  activeThread,
  appSettings,
  sanitizedProviderConnections,
  threadLabel,
}: {
  activeThread: ChatSettingsThreadRecord | null;
  appSettings: AppSettings;
  sanitizedProviderConnections: readonly ProviderConnectionRecord[];
  threadLabel: string;
}) {
  const settingsConnectionById = new Map(
    sanitizedProviderConnections.map((connection) => [connection.id, connection]),
  );
  const configuredDefaultConnection =
    settingsConnectionById.get(appSettings.activeMessengerConnectionId) ?? null;
  const firstAvailableConnection = sanitizedProviderConnections[0] ?? null;
  const fallbackConnection = configuredDefaultConnection ?? firstAvailableConnection;
  const fallbackConnectionPrefix = configuredDefaultConnection ? "App default" : "First available";
  const missingConnectionResolution = configuredDefaultConnection
    ? {
        actionLabel: `Use app default: ${configuredDefaultConnection.label}`,
        connectionId: configuredDefaultConnection.id,
      }
    : firstAvailableConnection
      ? {
          actionLabel: `Use first available: ${firstAvailableConnection.label}`,
          connectionId: firstAvailableConnection.id,
        }
      : {
          actionLabel: "Clear missing",
          connectionId: null,
        };
  const threadConnectionValue = activeThread?.providerConnectionId ?? "";
  const selectedConnection = threadConnectionValue
    ? (settingsConnectionById.get(threadConnectionValue) ?? null)
    : null;
  const hasMissingConnection = !!threadConnectionValue && !selectedConnection;
  const connectionSummary = !activeThread
    ? `No active ${threadLabel} thread`
    : hasMissingConnection
      ? "Missing connection"
      : selectedConnection
        ? selectedConnection.label
        : fallbackConnection
          ? `${fallbackConnectionPrefix}: ${fallbackConnection.label}`
          : "No connection available";

  return {
    connectionSummary,
    fallbackConnection,
    fallbackConnectionPrefix,
    hasMissingConnection,
    messengerConnectionValue: threadConnectionValue,
    missingConnectionResolution,
  };
}

export function getPersonaSettingsViewModel({
  activeThread,
  personas,
  threadLabel,
}: {
  activeThread: ChatSettingsThreadRecord | null;
  personas: readonly PersonaRecord[];
  threadLabel: string;
}) {
  const settingsPersonaById = new Map(personas.map((persona) => [persona.id, persona]));
  const selectedPersonaId = activeThread?.activePersonaId ?? "";
  const selectedPersona = selectedPersonaId
    ? (settingsPersonaById.get(selectedPersonaId) ?? null)
    : null;
  const hasMissingPersona = !!selectedPersonaId && !selectedPersona;
  const personaSummary = !activeThread
    ? `No active ${threadLabel} thread`
    : hasMissingPersona
      ? "Missing persona"
      : selectedPersona
        ? selectedPersona.displayName
        : "Anonymous";

  return {
    hasMissingPersona,
    personaSummary,
    selectedPersonaId,
  };
}
