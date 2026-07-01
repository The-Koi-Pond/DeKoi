import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";

export interface MessengerThreadReferenceSummary {
  availableCompanionCount: number;
  hasMissingConnection: boolean;
  hasMissingPersona: boolean;
  hasNoConnectionAvailable: boolean;
  missingCompanionCount: number;
  missingLorebookCount: number;
  selectedCompanionCount: number;
}

export interface MessengerThreadReferenceNotice {
  id: string;
  message: string;
  tone: "error" | "warning";
}

function countMissingIds(
  ids: readonly string[],
  availableIds: ReadonlySet<string>,
) {
  return ids.filter((id) => id.trim() && !availableIds.has(id)).length;
}

function countSelectedIds(
  ids: readonly string[],
  availableIds: ReadonlySet<string>,
) {
  return ids.filter((id) => availableIds.has(id)).length;
}

export function getMessengerThreadReferenceSummary({
  appSettings,
  characters,
  lorebooks,
  personas,
  providerConnections,
  thread,
}: {
  appSettings: AppSettings;
  characters: readonly CharacterRecord[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
  thread: MessengerThread;
}): MessengerThreadReferenceSummary {
  const characterIds = new Set(characters.map((character) => character.id));
  const lorebookIds = new Set(lorebooks.map((lorebook) => lorebook.id));
  const personaIds = new Set(personas.map((persona) => persona.id));
  const connectionIds = new Set(
    providerConnections.map((connection) => connection.id),
  );
  const explicitConnectionId = thread.providerConnectionId?.trim() ?? "";
  const defaultConnectionId = appSettings.activeMessengerConnectionId.trim();
  const hasFallbackConnection =
    (!!defaultConnectionId && connectionIds.has(defaultConnectionId)) ||
    providerConnections.length > 0;

  return {
    availableCompanionCount: characters.length,
    hasMissingConnection:
      explicitConnectionId.length > 0 && !connectionIds.has(explicitConnectionId),
    hasMissingPersona:
      !!thread.activePersonaId && !personaIds.has(thread.activePersonaId),
    hasNoConnectionAvailable: !hasFallbackConnection,
    missingCompanionCount: countMissingIds(thread.characterIds, characterIds),
    missingLorebookCount: countMissingIds(thread.lorebookIds, lorebookIds),
    selectedCompanionCount: countSelectedIds(thread.characterIds, characterIds),
  };
}

export function getMessengerThreadReferenceNotices(
  summary: MessengerThreadReferenceSummary,
): MessengerThreadReferenceNotice[] {
  const notices: MessengerThreadReferenceNotice[] = [];

  if (summary.hasNoConnectionAvailable) {
    notices.push({
      id: "no-connection",
      message: "Create a connection before Messenger can generate replies.",
      tone: "error",
    });
  } else if (summary.hasMissingConnection) {
    notices.push({
      id: "missing-connection",
      message:
        "This thread points to a connection that is no longer saved. Messenger will use an available connection until you update the thread.",
      tone: "warning",
    });
  }

  if (summary.selectedCompanionCount === 0) {
    notices.push({
      id: "no-companion",
      message:
        summary.missingCompanionCount > 0
          ? "This thread has no saved companions left. Clear the missing companions and choose a saved companion before sending."
          : summary.availableCompanionCount > 0
            ? "Choose a companion in thread settings before sending."
            : "Create a companion before Messenger can generate replies.",
      tone: "error",
    });
  } else if (summary.missingCompanionCount > 0) {
    notices.push({
      id: "missing-companions",
      message: `${summary.missingCompanionCount} selected companion${
        summary.missingCompanionCount === 1 ? " is" : "s are"
      } no longer saved. Messenger will skip missing companions when building replies.`,
      tone: "warning",
    });
  }

  if (summary.hasMissingPersona) {
    notices.push({
      id: "missing-persona",
      message:
        "The selected persona is no longer saved. New messages will send as Anonymous until you update the thread.",
      tone: "warning",
    });
  }

  if (summary.missingLorebookCount > 0) {
    notices.push({
      id: "missing-lorebooks",
      message: `${summary.missingLorebookCount} selected lorebook${
        summary.missingLorebookCount === 1 ? " is" : "s are"
      } no longer saved. Messenger will skip missing lorebooks when building replies.`,
      tone: "warning",
    });
  }

  return notices;
}

export function getMessengerThreadSendBlocker(
  summary: MessengerThreadReferenceSummary,
) {
  if (summary.hasNoConnectionAvailable) {
    return "Create a connection before Messenger can generate replies.";
  }
  if (summary.selectedCompanionCount > 0) return "";
  if (summary.missingCompanionCount > 0) {
    return "Open thread settings to clear missing companions and choose a saved companion.";
  }
  return summary.availableCompanionCount > 0
    ? "Choose a companion in thread settings before sending."
    : "Create a companion before Messenger can generate replies.";
}
