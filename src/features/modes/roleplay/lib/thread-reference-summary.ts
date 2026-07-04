import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
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
  providerConnections,
  thread,
}: {
  appSettings: AppSettings;
  characters: readonly CharacterRecord[];
  lorebooks: readonly LorebookRecord[];
  personas: readonly PersonaRecord[];
  providerConnections: readonly ProviderConnectionRecord[];
  thread: RoleplayThread;
}): RoleplayThreadReferenceSummary {
  return getThreadReferenceSummary({
    characters,
    fallbackProviderConnectionId: appSettings.activeMessengerConnectionId,
    globalLorebookIds: appSettings.globalLorebookIds,
    lorebooks,
    personas,
    providerConnections,
    thread,
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
