import { describe, expect, it } from "vitest";
import type { MessengerThread } from "../../../../engine/contracts/types/messenger";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import { transformMessengerPresetConfirm } from "./use-chat-settings-messenger-actions";
import { transformRoleplayPresetConfirm } from "./use-chat-settings-roleplay-actions";

const messenger = (input: Partial<MessengerThread> = {}): MessengerThread =>
  ({
    id: "m1",
    schemaVersion: 1,
    kind: "messenger",
    mode: "direct",
    title: "M",
    characterIds: [],
    activePersonaId: null,
    lorebookIds: [],
    presetId: "old",
    providerConnectionId: null,
    systemPromptMode: "custom",
    systemPrompt: "custom text",
    messages: [{ id: "message-1" } as never],
    createdAt: "now",
    updatedAt: "now",
    ...input,
  }) as MessengerThread;

const roleplay = (input: Partial<RoleplayThread> = {}): RoleplayThread =>
  ({
    id: "r1",
    schemaVersion: 1,
    kind: "roleplay",
    title: "R",
    characterIds: [],
    activePersonaId: null,
    lorebookIds: [],
    presetId: "old",
    providerConnectionId: null,
    entries: [{ id: "entry-1" } as never],
    createdAt: "now",
    updatedAt: "now",
    ...input,
  }) as RoleplayThread;

describe("chat settings preset transforms", () => {
  it("resets Messenger custom prompt only when switching presets", () => {
    const switched = transformMessengerPresetConfirm(messenger(), "new", {}, "later");
    expect(switched.systemPromptMode).toBe("default");
    expect(switched.messages).toHaveLength(1);
    const same = transformMessengerPresetConfirm(messenger(), "old", {}, "later");
    expect(same.systemPromptMode).toBe("custom");
    expect(same.systemPrompt).toBe("custom text");
  });

  it("transforms the latest supplied thread without dropping concurrent content", () => {
    const latestMessenger = messenger({ messages: [{ id: "message-2" } as never] });
    const latestRoleplay = roleplay({ entries: [{ id: "entry-2" } as never] });
    expect(
      transformMessengerPresetConfirm(latestMessenger, "new", {}, "later").messages[0].id,
    ).toBe("message-2");
    expect(transformRoleplayPresetConfirm(latestRoleplay, "new", {}, "later").entries[0].id).toBe(
      "entry-2",
    );
  });
});
