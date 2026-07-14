import type {
  ModeMessage,
  ModeThread,
  ModeThreadKind,
  ModeThreadOfKind,
} from "../../engine/contracts/types/mode-thread";
import type { AppStorageCollectionKey, AppStorageRecords } from "./app-storage-records";

type ModeThreadStorageRecordFor<K extends ModeThreadKind> = Omit<ModeThreadOfKind<K>, "messages">;
export type ModeThreadStorageRecord = {
  [K in ModeThreadKind]: ModeThreadStorageRecordFor<K>;
}[ModeThreadKind];

/** Join persisted thread metadata and messages into the canonical app shape. */
export function assembleModeThreads(
  metadata: readonly ModeThreadStorageRecord[],
  messages: readonly ModeMessage[],
): ModeThread[] {
  const threads: ModeThread[] = metadata.map((thread) => ({
    ...thread,
    messages: [] as ModeMessage[],
  }));
  const byId = new Map(threads.map((thread) => [thread.id, thread] as const));
  for (const message of messages) {
    const thread = byId.get(message.threadId);
    if (!thread) continue;
    const branch = thread.branches.find((candidate) => candidate.id === message.branchId);
    if (branch?.kind !== thread.kind) continue;
    thread.messages.push(message);
  }
  return threads;
}

/** Project canonical app threads to the split collections used by persistence/bundles. */
export function projectModeThreadCollections(modeThreads: readonly ModeThread[]) {
  return {
    modeThreads: modeThreads.map(toModeThreadStorageRecord),
    modeMessages: modeThreads.flatMap((thread) => thread.messages),
  };
}

export function toModeThreadStorageRecord(thread: ModeThread): ModeThreadStorageRecord {
  const { messages: _messages, ...metadata } = thread;
  void _messages;
  return metadata;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled app storage collection: ${value}`);
}

export function appStorageCollectionSignature(
  snapshot: AppStorageRecords,
  key: AppStorageCollectionKey,
): string {
  switch (key) {
    case "modeThreads":
      return JSON.stringify(snapshot.modeThreads.map(toModeThreadStorageRecord));
    case "modeMessages":
      return JSON.stringify(projectModeThreadCollections(snapshot.modeThreads).modeMessages);
    case "appSettings":
      return JSON.stringify(snapshot.appSettings);
    case "characters":
      return JSON.stringify(snapshot.characters);
    case "personas":
      return JSON.stringify(snapshot.personas);
    case "lorebooks":
      return JSON.stringify(snapshot.lorebooks);
    case "promptPresets":
      return JSON.stringify(snapshot.promptPresets);
    case "loreRuntimeStates":
      return JSON.stringify(snapshot.loreRuntimeStates);
    case "macroVariableStates":
      return JSON.stringify(snapshot.macroVariableStates);
    case "providerConnections":
      return JSON.stringify(snapshot.providerConnections);
    case "rippleStates":
      return JSON.stringify(snapshot.rippleStates);
  }
  return assertNever(key);
}

export function appStorageCollectionCount(
  snapshot: AppStorageRecords,
  key: AppStorageCollectionKey,
): number {
  switch (key) {
    case "appSettings":
      return 1;
    case "characters":
      return snapshot.characters.length;
    case "personas":
      return snapshot.personas.length;
    case "lorebooks":
      return snapshot.lorebooks.length;
    case "promptPresets":
      return snapshot.promptPresets.length;
    case "loreRuntimeStates":
      return snapshot.loreRuntimeStates.length;
    case "macroVariableStates":
      return snapshot.macroVariableStates.length;
    case "providerConnections":
      return snapshot.providerConnections.length;
    case "modeThreads":
      return snapshot.modeThreads.length;
    case "modeMessages":
      return projectModeThreadCollections(snapshot.modeThreads).modeMessages.length;
    case "rippleStates":
      return snapshot.rippleStates.length;
  }
  return assertNever(key);
}

export function appStorageCollectionSource(
  snapshot: AppStorageRecords,
  key: AppStorageCollectionKey,
): unknown {
  switch (key) {
    case "appSettings":
      return snapshot.appSettings;
    case "characters":
      return snapshot.characters;
    case "personas":
      return snapshot.personas;
    case "lorebooks":
      return snapshot.lorebooks;
    case "promptPresets":
      return snapshot.promptPresets;
    case "loreRuntimeStates":
      return snapshot.loreRuntimeStates;
    case "macroVariableStates":
      return snapshot.macroVariableStates;
    case "providerConnections":
      return snapshot.providerConnections;
    case "modeThreads":
      return snapshot.modeThreads;
    case "modeMessages":
      return projectModeThreadCollections(snapshot.modeThreads).modeMessages;
    case "rippleStates":
      return snapshot.rippleStates;
  }
  return assertNever(key);
}
