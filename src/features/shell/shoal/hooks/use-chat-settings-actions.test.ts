import { describe, expect, it } from "vitest";
import type {
  MessengerModeThread,
  RoleplayModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import {
  appendMessengerMessages,
  createMessengerThread,
} from "../../../../engine/modes/messenger/messenger-actions";
import {
  createModeMessage,
  getActiveModeBranch,
} from "../../../../engine/modes/mode-thread/mode-thread-actions";
import {
  appendRoleplayMessages,
  createRoleplayThread,
} from "../../../../engine/modes/roleplay/roleplay-actions";
import { transformMessengerPresetConfirm } from "./use-chat-settings-messenger-actions";
import { transformRoleplayPresetConfirm } from "./use-chat-settings-roleplay-actions";

const now = "2026-07-09T00:00:00.000Z";
const later = "2026-07-09T00:01:00.000Z";

function messenger(messageId = "message-1"): MessengerModeThread {
  const thread = createMessengerThread({
    id: "m1",
    branchId: "m1-branch",
    title: "M",
    characterIds: [],
    activePersonaId: null,
    defaultPromptPresetId: "old",
    now,
  });
  return appendMessengerMessages(thread, [
    createModeMessage({
      id: messageId,
      versionId: `${messageId}-version`,
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "unknown", label: "User" },
      body: "Message",
      origin: "manual",
      now,
    }),
  ]);
}

function roleplay(messageId = "message-1"): RoleplayModeThread {
  const thread = createRoleplayThread({
    id: "r1",
    branchId: "r1-branch",
    title: "R",
    characterIds: [],
    activePersonaId: null,
    openingCharacter: null,
    defaultPromptPresetId: "old",
    now,
  });
  return appendRoleplayMessages(thread, [
    createModeMessage({
      id: messageId,
      versionId: `${messageId}-version`,
      threadId: thread.id,
      branchId: thread.activeBranchId,
      author: { kind: "system", label: "Scene" },
      body: "Scene beat",
      origin: "manual",
      now,
    }),
  ]);
}

describe("chat settings preset transforms", () => {
  it("changes Messenger presets without changing messages", () => {
    const switched = transformMessengerPresetConfirm(messenger(), "new", {}, later);
    expect(getActiveModeBranch(switched).presetId).toBe("new");
    expect(switched.messages).toHaveLength(1);
    const same = transformMessengerPresetConfirm(messenger(), "old", {}, later);
    expect(getActiveModeBranch(same).presetId).toBe("old");
  });

  it("transforms the latest supplied thread without dropping concurrent content", () => {
    const latestMessenger = messenger("message-2");
    const latestRoleplay = roleplay("message-2");
    expect(transformMessengerPresetConfirm(latestMessenger, "new", {}, later).messages[0].id).toBe(
      "message-2",
    );
    expect(transformRoleplayPresetConfirm(latestRoleplay, "new", {}, later).messages[0].id).toBe(
      "message-2",
    );
  });
});
