import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
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

export function getCompanionSettingsViewModel({
  activeMessengerThread,
  characters,
}: {
  activeMessengerThread: MessengerThread | null;
  characters: readonly CharacterRecord[];
}) {
  const settingsCharacterById = new Map(
    characters.map((character) => [character.id, character]),
  );
  const selectedCompanionIds = activeMessengerThread?.characterIds ?? [];
  const selectedCompanionNames = activeMessengerThread
    ? activeMessengerThread.characterIds.flatMap((characterId) => {
        const character = settingsCharacterById.get(characterId);
        return character ? [character.displayName] : [];
      })
    : [];
  const missingCompanionIds = selectedCompanionIds.filter(
    (characterId) => !settingsCharacterById.has(characterId),
  );
  const selectedCompanionCount = selectedCompanionNames.length;
  const missingCompanionCount = missingCompanionIds.length;
  const companionDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingCompanionCount > 0
      ? `${selectedCompanionNames.length} selected, ${missingCompanionCount} missing`
      : selectedCompanionCount === 0
        ? "No companions selected"
        : `${selectedCompanionCount} selected`;
  const companionSelectionLabel =
    selectedCompanionNames.join(", ") ||
    (missingCompanionCount > 0
      ? `${missingCompanionCount} missing companion${
          missingCompanionCount === 1 ? "" : "s"
        }`
      : "Choose companions");

  return {
    companionDrawerSummary,
    companionSelectionLabel,
    missingCompanionCount,
    selectedCompanionCount,
    selectedCompanionIds,
  };
}

export function getLorebookSettingsViewModel({
  activeMessengerThread,
  lorebooks,
}: {
  activeMessengerThread: MessengerThread | null;
  lorebooks: readonly LorebookRecord[];
}) {
  const settingsLorebookById = new Map(
    lorebooks.map((lorebook) => [lorebook.id, lorebook]),
  );
  const selectedLorebookIds = activeMessengerThread?.lorebookIds ?? [];
  const selectedLorebookNames = activeMessengerThread
    ? activeMessengerThread.lorebookIds.flatMap((lorebookId) => {
        const lorebook = settingsLorebookById.get(lorebookId);
        return lorebook ? [lorebook.title] : [];
      })
    : [];
  const missingLorebookIds = selectedLorebookIds.filter(
    (lorebookId) => !settingsLorebookById.has(lorebookId),
  );
  const selectedLorebookCount = selectedLorebookNames.length;
  const missingLorebookCount = missingLorebookIds.length;
  const lorebookDrawerSummary = !activeMessengerThread
    ? "No active Messenger thread"
    : missingLorebookCount > 0
      ? `${selectedLorebookNames.length} selected, ${missingLorebookCount} missing`
      : selectedLorebookCount === 0
        ? "No lorebooks selected"
        : `${selectedLorebookCount} lorebook${
            selectedLorebookCount === 1 ? "" : "s"
          }`;

  return {
    lorebookDrawerSummary,
    missingLorebookCount,
    selectedLorebookIds,
  };
}
