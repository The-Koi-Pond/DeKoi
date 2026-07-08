import type { AppSettings } from "../../../../engine/contracts/types/app-settings";
import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { PersonaRecord } from "../../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import {
  getThreadReferenceNotices,
  getThreadReferenceSummary,
  getThreadSendBlocker,
  type ThreadReferenceNotice,
  type ThreadReferenceSummary,
} from "../../shared/thread-reference-summary";

const MESSENGER_REFERENCE_LABELS = {
  surfaceLabel: "Messenger",
  settingsLabel: "thread settings",
  threadNoun: "thread",
};

export type MessengerThreadReferenceSummary = ThreadReferenceSummary;
export type MessengerThreadReferenceNotice = ThreadReferenceNotice;

export function getMessengerThreadReferenceSummary({
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
  thread: MessengerThread;
}): MessengerThreadReferenceSummary {
  return getThreadReferenceSummary({
    characters,
    fallbackProviderConnectionId: appSettings.activeMessengerConnectionId,
    globalLorebookIds: appSettings.globalLorebookIds,
    lorebooks,
    personas,
    promptPresets,
    providerConnections,
    thread,
  });
}

export function getMessengerThreadReferenceNotices(
  summary: MessengerThreadReferenceSummary,
): MessengerThreadReferenceNotice[] {
  return getThreadReferenceNotices(summary, MESSENGER_REFERENCE_LABELS);
}

export function getMessengerThreadSendBlocker(summary: MessengerThreadReferenceSummary) {
  return getThreadSendBlocker(summary, MESSENGER_REFERENCE_LABELS);
}
