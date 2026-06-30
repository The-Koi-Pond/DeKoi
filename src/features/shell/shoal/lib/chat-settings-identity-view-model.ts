import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";

export function getConnectionSettingsViewModel({
  activeMessengerThread,
  appSettings,
  sanitizedProviderConnections,
}: {
  activeMessengerThread: MessengerThread | null;
  appSettings: AppSettings;
  sanitizedProviderConnections: readonly ProviderConnectionRecord[];
}) {
  const settingsConnectionById = new Map(
    sanitizedProviderConnections.map((connection) => [connection.id, connection]),
  );
  const configuredDefaultConnection =
    settingsConnectionById.get(appSettings.activeMessengerConnectionId) ?? null;
  const firstAvailableConnection = sanitizedProviderConnections[0] ?? null;
  const fallbackConnection =
    configuredDefaultConnection ?? firstAvailableConnection;
  const fallbackConnectionPrefix = configuredDefaultConnection
    ? "App default"
    : "First available";
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
  const messengerConnectionValue = activeMessengerThread?.providerConnectionId ?? "";
  const selectedConnection = messengerConnectionValue
    ? settingsConnectionById.get(messengerConnectionValue) ?? null
    : null;
  const hasMissingConnection = !!messengerConnectionValue && !selectedConnection;
  const connectionSummary = !activeMessengerThread
    ? "No active Messenger thread"
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
    messengerConnectionValue,
    missingConnectionResolution,
  };
}

export function getPersonaSettingsViewModel({
  activeMessengerThread,
  personas,
}: {
  activeMessengerThread: MessengerThread | null;
  personas: readonly PersonaRecord[];
}) {
  const settingsPersonaById = new Map(
    personas.map((persona) => [persona.id, persona]),
  );
  const selectedPersonaId = activeMessengerThread?.activePersonaId ?? "";
  const selectedPersona = selectedPersonaId
    ? settingsPersonaById.get(selectedPersonaId) ?? null
    : null;
  const hasMissingPersona = !!selectedPersonaId && !selectedPersona;
  const personaSummary = !activeMessengerThread
    ? "No active Messenger thread"
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
