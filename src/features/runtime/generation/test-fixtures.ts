import type {
  MessengerModeThread,
  ModeMessage,
  RoleplayModeThread,
} from "../../../engine/contracts/types/mode-thread";

export const fixtureNow = "2026-07-02T00:00:00.000Z";
export const messengerThreadId = "messenger-thread-1";
export const roleplayThreadId = "roleplay-thread-1";
export const messengerBranchId = "messenger-branch-1";
export const roleplayBranchId = "roleplay-branch-1";

function version(id: string, body: string, origin: "manual" | "generated" = "manual") {
  return { id, body, origin, createdAt: fixtureNow, updatedAt: fixtureNow } as const;
}

export function messengerMessage(body = "Hello."): ModeMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: messengerThreadId,
    branchId: messengerBranchId,
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    versions: [version("message-1-v1", body)],
    activeVersionId: "message-1-v1",
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  };
}

export function roleplayMessage(body = "Hello."): ModeMessage {
  return {
    id: "message-1",
    schemaVersion: 1,
    threadId: roleplayThreadId,
    branchId: roleplayBranchId,
    author: { kind: "persona", personaId: "persona-1", label: "Alex" },
    versions: [version("message-1-v1", body)],
    activeVersionId: "message-1-v1",
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  };
}

export function systemMessage(threadKind: "messenger" | "roleplay", body: string): ModeMessage {
  const base = threadKind === "messenger" ? messengerMessage(body) : roleplayMessage(body);
  return {
    ...base,
    id: `${threadKind}-system-1`,
    author: { kind: "system", label: "System" },
    versions: [version(`${threadKind}-system-1-v1`, body)],
    activeVersionId: `${threadKind}-system-1-v1`,
  };
}

export function messengerThread(message = messengerMessage()): MessengerModeThread {
  return {
    id: messengerThreadId,
    schemaVersion: 1,
    kind: "messenger",
    title: "Thread",
    activeBranchId: messengerBranchId,
    branches: [
      {
        id: messengerBranchId,
        schemaVersion: 1,
        threadId: messengerThreadId,
        kind: "messenger",
        participantMode: "direct",
        characterIds: ["character-1"],
        activePersonaId: null,
        lorebookIds: ["lorebook-1"],
        presetId: null,
        presetChoiceSelectionsByPresetId: {},
        providerConnectionId: null,
        createdAt: fixtureNow,
        updatedAt: fixtureNow,
      },
    ],
    messages: [message],
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  };
}

export function roleplayThread(message = roleplayMessage()): RoleplayModeThread {
  return {
    id: roleplayThreadId,
    schemaVersion: 1,
    kind: "roleplay",
    title: "Scene",
    openingCharacterId: null,
    activeBranchId: roleplayBranchId,
    branches: [
      {
        id: roleplayBranchId,
        schemaVersion: 1,
        threadId: roleplayThreadId,
        kind: "roleplay",
        participantMode: "direct",
        replyStrategy: "natural",
        characterIds: ["character-1"],
        activePersonaId: null,
        lorebookIds: ["lorebook-1"],
        presetId: null,
        presetChoiceSelectionsByPresetId: {},
        providerConnectionId: null,
        createdAt: fixtureNow,
        updatedAt: fixtureNow,
      },
    ],
    messages: [message],
    createdAt: fixtureNow,
    updatedAt: fixtureNow,
  };
}
