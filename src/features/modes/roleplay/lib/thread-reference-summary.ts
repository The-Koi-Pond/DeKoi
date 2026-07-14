import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { RoleplayModeThread } from "../../../../engine/contracts/types/mode-thread";
import {
  getThreadReferenceNotices,
  getThreadReferenceSummary,
  getThreadSendBlocker,
  type ThreadReferenceNotice,
  type ThreadReferenceSummary,
} from "../../shared/thread-reference-summary";

const ROLEPLAY_REFERENCE_LABELS = {
  surfaceLabel: "Roleplay",
  settingsLabel: "thread settings",
  threadNoun: "thread",
};

export type RoleplayThreadReferenceSummary = ThreadReferenceSummary;
export type RoleplayThreadReferenceNotice = ThreadReferenceNotice;

export function getRoleplayThreadReferenceSummary({
  appSettings,
  characters,
  lorebooks,
  personas,
  promptPresets,
  providerConnections,
  thread,
}: {
  appSettings: AppSettings;
  characters: readonly CharacterRecord[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  promptPresets: readonly PromptPresetRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
  thread: RoleplayModeThread;
}): RoleplayThreadReferenceSummary {
  return getThreadReferenceSummary({
    characters,
    fallbackProviderConnectionId: appSettings.activeMessengerConnectionId,
    globalLorebookIds: appSettings.globalLorebookIds,
    lorebooks,
    personas,
    promptPresets,
    providerConnections,
    thread: {
      activePersonaId:
        thread.branches.find((branch) => branch.id === thread.activeBranchId)?.activePersonaId ??
        null,
      characterIds:
        thread.branches.find((branch) => branch.id === thread.activeBranchId)?.characterIds ?? [],
      lorebookIds:
        thread.branches.find((branch) => branch.id === thread.activeBranchId)?.lorebookIds ?? [],
      presetId:
        thread.branches.find((branch) => branch.id === thread.activeBranchId)?.presetId ?? null,
      providerConnectionId:
        thread.branches.find((branch) => branch.id === thread.activeBranchId)
          ?.providerConnectionId ?? null,
    },
  });
}

export function getRoleplayThreadReferenceNotices(
  summary: RoleplayThreadReferenceSummary,
): RoleplayThreadReferenceNotice[] {
  return getThreadReferenceNotices(summary, ROLEPLAY_REFERENCE_LABELS);
}

export function getRoleplayThreadSendBlocker(summary: RoleplayThreadReferenceSummary) {
  return getThreadSendBlocker(summary, ROLEPLAY_REFERENCE_LABELS);
}
