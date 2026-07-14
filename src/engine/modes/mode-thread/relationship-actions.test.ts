import { describe, expect, it } from "vitest";
import {
  clearModeThreadPersona,
  createModeMessage,
  removeModeThreadCharacter,
  removeModeThreadLorebook,
  replaceModeThreadProviderConnection,
} from "./mode-thread-actions";
import type { MessengerModeThread, RoleplayModeThread } from "../../contracts/types/mode-thread";
import {
  createMessengerThread,
  removeMessengerThreadCharacter,
} from "../messenger/messenger-actions";
import { createRoleplayThread, clearRoleplayThreadPersona } from "../roleplay/roleplay-actions";

describe("mode relationship cascades", () => {
  it.each(["messenger", "roleplay"] as const)(
    "applies every relationship cascade across inactive %s branches and preserves no-op identity",
    (kind) => {
      const base =
        kind === "messenger"
          ? createMessengerThread({
              id: `${kind}-thread`,
              branchId: "active",
              title: "Thread",
              characterIds: ["character-a"],
              activePersonaId: "persona-a",
              lorebookIds: ["lorebook-a"],
              providerConnectionId: "provider-a",
              now: "2026-01-01T00:00:00.000Z",
            })
          : createRoleplayThread({
              id: `${kind}-thread`,
              branchId: "active",
              title: "Thread",
              characterIds: ["character-a"],
              activePersonaId: "persona-a",
              lorebookIds: ["lorebook-a"],
              providerConnectionId: "provider-a",
              openingCharacter: null,
              now: "2026-01-01T00:00:00.000Z",
            });
      const inactive = {
        ...base.branches[0]!,
        id: "inactive",
        characterIds: ["character-a", "character-b"],
        participantMode: "group" as const,
        activePersonaId: "persona-a",
        lorebookIds: ["lorebook-a", "lorebook-b"],
        providerConnectionId: "provider-a",
      };
      const thread = { ...base, branches: [base.branches[0]!, inactive] } as
        MessengerModeThread | RoleplayModeThread;
      const at = "2026-01-02T00:00:00.000Z";
      const afterCharacter = removeModeThreadCharacter(thread, "character-a", at);
      const afterPersona = clearModeThreadPersona(afterCharacter, "persona-a", at);
      const afterLorebook = removeModeThreadLorebook(afterPersona, "lorebook-a", at);
      const afterProvider = replaceModeThreadProviderConnection(
        afterLorebook,
        "provider-a",
        "provider-b",
        at,
      );

      expect(
        afterProvider.branches.every((branch) => !branch.characterIds.includes("character-a")),
      ).toBe(true);
      expect(afterProvider.branches.every((branch) => branch.activePersonaId === null)).toBe(true);
      expect(
        afterProvider.branches.every((branch) => !branch.lorebookIds.includes("lorebook-a")),
      ).toBe(true);
      expect(
        afterProvider.branches.every((branch) => branch.providerConnectionId === "provider-b"),
      ).toBe(true);
      expect(removeModeThreadCharacter(afterProvider, "missing", at)).toBe(afterProvider);
      expect(clearModeThreadPersona(afterProvider, "missing", at)).toBe(afterProvider);
      expect(removeModeThreadLorebook(afterProvider, "missing", at)).toBe(afterProvider);
      expect(replaceModeThreadProviderConnection(afterProvider, "missing", null, at)).toBe(
        afterProvider,
      );
    },
  );

  it("updates inactive Messenger branches while preserving messages and sibling fields", () => {
    const base = createMessengerThread({
      id: "thread",
      branchId: "active",
      title: "Thread",
      characterIds: ["character-a"],
      activePersonaId: "persona-a",
      systemPrompt: "System",
      now: "2026-01-01T00:00:00.000Z",
    });
    const inactive: MessengerModeThread["branches"][number] = {
      ...base.branches[0],
      id: "inactive",
      participantMode: "group",
      characterIds: ["character-a", "character-b"],
      activePersonaId: "persona-b",
      providerConnectionId: "provider-b",
    };
    const message = createModeMessage({
      id: "message",
      versionId: "version",
      threadId: base.id,
      branchId: inactive.id,
      author: { kind: "system", label: "System" },
      body: "keep me",
      origin: "manual",
      now: "2026-01-01T00:00:00.000Z",
    });
    const thread: MessengerModeThread = {
      ...base,
      branches: [base.branches[0]!, inactive],
      messages: [message],
    };

    const next = removeMessengerThreadCharacter(thread, "character-a", "2026-01-02T00:00:00.000Z");

    expect(next.branches.map((branch) => branch.characterIds)).toEqual([[], ["character-b"]]);
    expect(next.branches[1]?.activePersonaId).toBe("persona-b");
    expect(next.messages).toEqual([message]);
    expect(next.branches[1]?.providerConnectionId).toBe("provider-b");
  });

  it("clears persona references on inactive Roleplay branches only", () => {
    const base = createRoleplayThread({
      id: "roleplay",
      branchId: "active",
      title: "Roleplay",
      characterIds: ["character-a"],
      activePersonaId: "persona-a",
      systemPrompt: "System",
      openingCharacter: null,
      now: "2026-01-01T00:00:00.000Z",
    });
    const inactive = { ...base.branches[0], id: "inactive", activePersonaId: "persona-a" };
    const next = clearRoleplayThreadPersona(
      { ...base, branches: [base.branches[0]!, inactive] },
      "persona-a",
      "2026-01-02T00:00:00.000Z",
    );

    expect(next.branches.map((branch) => branch.activePersonaId)).toEqual([null, null]);
    expect(next.branches[0]?.replyStrategy).toBe(base.branches[0]?.replyStrategy);
  });
});
