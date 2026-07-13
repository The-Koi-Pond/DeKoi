import type { AppSettings } from "../contracts/types/app-settings";
import type { MessengerThread } from "../contracts/types/messenger";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import type { RoleplayThread } from "../contracts/types/roleplay";

export type PromptPresetRelationshipMutation =
  | { kind: "delete"; presetId: string; updatedAt: string }
  | { kind: "set-default"; presetId: string };

export type PromptPresetRelationshipTransactionResult = {
  saved: boolean;
  published: boolean;
  blocked: boolean;
  message: string;
};

export type PromptPresetRelationshipSnapshot = {
  appSettings: AppSettings;
  promptPresets: PromptPresetRecord[];
  messengerThreads: MessengerThread[];
  roleplayThreads: RoleplayThread[];
};

export type PromptPresetDeletionPlan =
  | {
      ok: true;
      snapshot: PromptPresetRelationshipSnapshot;
      reassignedMessenger: number;
      reassignedRoleplay: number;
    }
  | {
      ok: false;
      reason: "missing" | "default" | "invalid-default" | "last-preset";
    };

export function planPromptPresetDeletion(
  snapshot: PromptPresetRelationshipSnapshot,
  presetId: string,
  updatedAt: string,
): PromptPresetDeletionPlan {
  const cleanId = presetId.trim();
  const preset = snapshot.promptPresets.find((candidate) => candidate.id === cleanId);
  if (!preset) return { ok: false, reason: "missing" };
  if (snapshot.appSettings.defaultPromptPresetId === cleanId)
    return { ok: false, reason: "default" };

  const fallbackId = snapshot.appSettings.defaultPromptPresetId;
  const fallbackExists =
    !!fallbackId && snapshot.promptPresets.some((candidate) => candidate.id === fallbackId);
  if (snapshot.promptPresets.length <= 1) return { ok: false, reason: "last-preset" };
  if (!fallbackExists) return { ok: false, reason: "invalid-default" };
  const messengerThreads = snapshot.messengerThreads.map((thread) =>
    thread.presetId === cleanId && fallbackId
      ? {
          ...thread,
          presetId: fallbackId,
          updatedAt,
          presetChoiceSelectionsByPresetId: thread.presetChoiceSelectionsByPresetId ?? {},
        }
      : thread,
  );
  const roleplayThreads = snapshot.roleplayThreads.map((thread) =>
    thread.presetId === cleanId && fallbackId
      ? {
          ...thread,
          presetId: fallbackId,
          updatedAt,
          presetChoiceSelectionsByPresetId: thread.presetChoiceSelectionsByPresetId ?? {},
        }
      : thread,
  );

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      promptPresets: snapshot.promptPresets.filter((candidate) => candidate.id !== cleanId),
      messengerThreads,
      roleplayThreads,
    },
    reassignedMessenger: messengerThreads.filter(
      (thread, index) => thread !== snapshot.messengerThreads[index],
    ).length,
    reassignedRoleplay: roleplayThreads.filter(
      (thread, index) => thread !== snapshot.roleplayThreads[index],
    ).length,
  };
}

export function planPromptPresetDefault(
  snapshot: PromptPresetRelationshipSnapshot,
  presetId: string,
): PromptPresetRelationshipSnapshot | null {
  const cleanId = presetId.trim();
  if (!snapshot.promptPresets.some((preset) => preset.id === cleanId)) return null;
  if (snapshot.appSettings.defaultPromptPresetId === cleanId) return snapshot;
  return { ...snapshot, appSettings: { ...snapshot.appSettings, defaultPromptPresetId: cleanId } };
}
