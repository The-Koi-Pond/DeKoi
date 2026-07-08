import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { cleanTextArray } from "../../../shared/text";

export interface ThreadReferenceRecord {
  activePersonaId: string | null;
  characterIds: string[];
  lorebookIds: string[];
  presetId: string | null;
  providerConnectionId: string | null;
}

export interface ThreadReferenceSummary {
  availableCompanionCount: number;
  hasMissingConnection: boolean;
  hasMissingPersona: boolean;
  hasMissingPreset: boolean;
  hasNoConnectionAvailable: boolean;
  missingCompanionCount: number;
  missingLorebookCount: number;
  selectedCompanionCount: number;
}

export interface ThreadReferenceNotice {
  id: string;
  message: string;
  tone: "error" | "warning";
}

export interface ThreadReferenceNoticeLabels {
  surfaceLabel: string;
  settingsLabel?: string;
  threadNoun?: string;
}

function countMissingIds(ids: readonly string[], availableIds: ReadonlySet<string>) {
  return ids.filter((id) => id.trim() && !availableIds.has(id)).length;
}

function countSelectedIds(ids: readonly string[], availableIds: ReadonlySet<string>) {
  return ids.filter((id) => availableIds.has(id)).length;
}

function collectReferencedLorebookIds({
  characters,
  globalLorebookIds,
  personas,
  thread,
}: {
  characters: readonly CharacterRecord[];
  globalLorebookIds: readonly string[];
  personas: readonly PersonaRecord[];
  thread: ThreadReferenceRecord;
}) {
  const characterById = new Map(characters.map((character) => [character.id, character]));
  const personaById = new Map(personas.map((persona) => [persona.id, persona]));
  const activePersona = thread.activePersonaId
    ? (personaById.get(thread.activePersonaId) ?? null)
    : null;
  const companionLorebookIds = [...new Set(thread.characterIds)].flatMap(
    (characterId) => characterById.get(characterId)?.lorebookIds ?? [],
  );
  const referencedIds = [
    ...thread.lorebookIds,
    ...(activePersona?.lorebookIds ?? []),
    ...companionLorebookIds,
    ...globalLorebookIds,
  ];

  return cleanTextArray(referencedIds);
}

export function getThreadReferenceSummary({
  characters,
  fallbackProviderConnectionId,
  globalLorebookIds = [],
  lorebooks,
  personas,
  promptPresets,
  providerConnections,
  thread,
}: {
  characters: readonly CharacterRecord[];
  fallbackProviderConnectionId?: string | null;
  globalLorebookIds?: readonly string[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  promptPresets: readonly PromptPresetRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
  thread: ThreadReferenceRecord;
}): ThreadReferenceSummary {
  const characterIds = new Set(characters.map((character) => character.id));
  const lorebookIds = new Set(lorebooks.map((lorebook) => lorebook.id));
  const personaIds = new Set(personas.map((persona) => persona.id));
  const presetIds = new Set(promptPresets.map((preset) => preset.id));
  const connectionIds = new Set(providerConnections.map((connection) => connection.id));
  const explicitConnectionId = thread.providerConnectionId?.trim() ?? "";
  const fallbackConnectionId = fallbackProviderConnectionId?.trim() ?? "";
  const hasFallbackConnection =
    (!!fallbackConnectionId && connectionIds.has(fallbackConnectionId)) ||
    providerConnections.length > 0;

  return {
    availableCompanionCount: characters.length,
    hasMissingConnection:
      explicitConnectionId.length > 0 && !connectionIds.has(explicitConnectionId),
    hasMissingPersona: !!thread.activePersonaId && !personaIds.has(thread.activePersonaId),
    hasMissingPreset: !!thread.presetId && !presetIds.has(thread.presetId),
    hasNoConnectionAvailable: !hasFallbackConnection,
    missingCompanionCount: countMissingIds(thread.characterIds, characterIds),
    missingLorebookCount: countMissingIds(
      collectReferencedLorebookIds({ characters, globalLorebookIds, personas, thread }),
      lorebookIds,
    ),
    selectedCompanionCount: countSelectedIds(thread.characterIds, characterIds),
  };
}

export function getThreadReferenceNotices(
  summary: ThreadReferenceSummary,
  labels: ThreadReferenceNoticeLabels,
): ThreadReferenceNotice[] {
  const notices: ThreadReferenceNotice[] = [];
  const settingsLabel = labels.settingsLabel ?? "thread settings";
  const threadNoun = labels.threadNoun ?? "thread";

  if (summary.hasNoConnectionAvailable) {
    notices.push({
      id: "no-connection",
      message: `Create a connection before ${labels.surfaceLabel} can generate replies.`,
      tone: "error",
    });
  } else if (summary.hasMissingConnection) {
    notices.push({
      id: "missing-connection",
      message: `This ${threadNoun} points to a connection that is no longer saved. ${labels.surfaceLabel} will use an available connection until you update the ${threadNoun}.`,
      tone: "warning",
    });
  }

  if (summary.selectedCompanionCount === 0) {
    notices.push({
      id: "no-companion",
      message:
        summary.missingCompanionCount > 0
          ? `This ${threadNoun} has no saved companions left. Clear the missing companions and choose a saved companion before sending.`
          : summary.availableCompanionCount > 0
            ? `Choose a companion in ${settingsLabel} before sending.`
            : `Create a companion before ${labels.surfaceLabel} can generate replies.`,
      tone: "error",
    });
  } else if (summary.missingCompanionCount > 0) {
    notices.push({
      id: "missing-companions",
      message: `${summary.missingCompanionCount} selected companion${
        summary.missingCompanionCount === 1 ? " is" : "s are"
      } no longer saved. ${labels.surfaceLabel} will skip missing companions when building replies.`,
      tone: "warning",
    });
  }

  if (summary.hasMissingPersona) {
    notices.push({
      id: "missing-persona",
      message: `The selected persona is no longer saved. New messages will send as Anonymous until you update the ${threadNoun}.`,
      tone: "warning",
    });
  }

  if (summary.hasMissingPreset) {
    notices.push({
      id: "missing-preset",
      message: `The selected prompt preset is no longer saved. ${labels.surfaceLabel} will use the default prompt until you update the ${threadNoun}.`,
      tone: "warning",
    });
  }

  if (summary.missingLorebookCount > 0) {
    notices.push({
      id: "missing-lorebooks",
      message: `${summary.missingLorebookCount} selected lorebook${
        summary.missingLorebookCount === 1 ? " is" : "s are"
      } no longer saved. ${labels.surfaceLabel} will skip missing lorebooks when building replies.`,
      tone: "warning",
    });
  }

  return notices;
}

export function getThreadSendBlocker(
  summary: ThreadReferenceSummary,
  labels: ThreadReferenceNoticeLabels,
) {
  const settingsLabel = labels.settingsLabel ?? "thread settings";

  if (summary.hasNoConnectionAvailable) {
    return `Create a connection before ${labels.surfaceLabel} can generate replies.`;
  }
  if (summary.selectedCompanionCount > 0) return "";
  if (summary.missingCompanionCount > 0) {
    return "Open thread settings to clear missing companions and choose a saved companion.";
  }
  return summary.availableCompanionCount > 0
    ? `Choose a companion in ${settingsLabel} before sending.`
    : `Create a companion before ${labels.surfaceLabel} can generate replies.`;
}
