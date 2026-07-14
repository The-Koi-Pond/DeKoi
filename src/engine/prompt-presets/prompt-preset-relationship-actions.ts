import type { AppSettings } from "../contracts/types/app-settings";
import type { ModeThread } from "../contracts/types/mode-thread";
import type { PromptPresetRecord } from "../contracts/types/prompt-presets";
import { setModeBranchPreset } from "../modes/mode-thread/mode-thread-actions";

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
  modeThreads: ModeThread[];
};

export type PromptPresetDeletionPlan =
  | {
      ok: true;
      snapshot: PromptPresetRelationshipSnapshot;
      reassignedModeThreads: number;
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
  const modeThreads = snapshot.modeThreads.map((thread) => {
    let next: ModeThread = thread;
    for (const branch of thread.branches) {
      if (branch.presetId !== cleanId || !fallbackId) continue;
      next = setModeBranchPreset(next, branch.id, fallbackId, updatedAt);
    }
    return next;
  });

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      promptPresets: snapshot.promptPresets.filter((candidate) => candidate.id !== cleanId),
      modeThreads,
    },
    reassignedModeThreads: modeThreads.filter(
      (thread, index) => thread !== snapshot.modeThreads[index],
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
