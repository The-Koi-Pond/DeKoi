import { describe, expect, it } from "vitest";
import {
  createMessengerThread,
  createPersonaMessengerMessage,
  getNextMessengerCompanion,
  appendMessengerMessages,
  deleteMessengerMessage,
} from "./messenger/messenger-actions";
import {
  createRoleplayThread,
  createSystemRoleplayMessage,
  getNextRoleplayCompanion,
  createCompanionRoleplayMessage,
  appendRoleplayMessages,
  deleteRoleplayMessage,
} from "./roleplay/roleplay-actions";
import type { CharacterRecord } from "../contracts/types/character";
import type { RoleplayModeThread } from "../contracts/types/mode-thread";
import type { MessengerModeThread } from "../contracts/types/mode-thread";
import type { PersonaRecord } from "../contracts/types/persona";

const character = (id: string): CharacterRecord => ({
  id,
  schemaVersion: 1,
  displayName: id,
  nickname: null,
  description: "",
  personality: "",
  scenario: "",
  firstMessage: "",
  alternateGreetings: [],
  groupOnlyGreetings: [],
  exampleMessages: "",
  systemPrompt: "",
  postHistoryInstructions: "",
  creator: "",
  characterVersion: "",
  creatorNotes: "",
  tags: [],
  characterNote: "",
  characterNoteDepth: 0,
  characterNoteRole: "system",
  talkativeness: 0,
  avatarUrl: null,
  lorebookIds: [],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});
const persona: PersonaRecord = {
  id: "p",
  schemaVersion: 1,
  displayName: "P",
  nickname: null,
  description: "",
  personality: "",
  scenario: "",
  systemPrompt: "",
  postHistoryInstructions: "",
  creator: "",
  characterVersion: "",
  creatorNotes: "",
  tags: [],
  characterNote: "",
  characterNoteDepth: 0,
  characterNoteRole: "system",
  talkativeness: 0,
  avatarUrl: null,
  lorebookIds: [],
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
};

describe("slice 2 concrete mode actions", () => {
  it("maps default prompt presets onto messenger and roleplay branches", () => {
    const messenger = createMessengerThread({
      id: "messenger-preset",
      branchId: "messenger-branch",
      title: "M",
      characterIds: [],
      activePersonaId: null,
      defaultPromptPresetId: " preset ",
      now: "2026-01-01",
    });
    const roleplay = createRoleplayThread({
      id: "roleplay-preset",
      branchId: "roleplay-branch",
      title: "R",
      characterIds: [],
      activePersonaId: null,
      openingCharacter: null,
      defaultPromptPresetId: " preset ",
      now: "2026-01-01",
    });
    expect(messenger.branches[0].presetId).toBe("preset");
    expect(roleplay.branches[0].presetId).toBe("preset");

    const messengerWithoutPreset = createMessengerThread({
      id: "messenger-no-preset",
      branchId: "messenger-no-preset-branch",
      title: "M",
      characterIds: [],
      activePersonaId: null,
      defaultPromptPresetId: "   ",
      now: "2026-01-01",
    });
    const roleplayWithoutPreset = createRoleplayThread({
      id: "roleplay-no-preset",
      branchId: "roleplay-no-preset-branch",
      title: "R",
      characterIds: [],
      activePersonaId: null,
      openingCharacter: null,
      defaultPromptPresetId: null,
      now: "2026-01-01",
    });
    expect(messengerWithoutPreset.branches[0].presetId).toBeNull();
    expect(roleplayWithoutPreset.branches[0].presetId).toBeNull();
  });

  it("creates a single messenger branch and deterministic message versions", () => {
    const thread = createMessengerThread({
      id: "t",
      branchId: "b",
      title: " Chat ",
      characterIds: ["c"],
      activePersonaId: "p",
      now: "2026-01-01",
    });
    const message = createPersonaMessengerMessage({
      thread,
      persona,
      id: "m",
      versionId: "v",
      body: " hi ",
      now: "2026-01-01",
    });
    expect(thread.branches).toHaveLength(1);
    expect(message.versions).toHaveLength(1);
    expect(message.activeVersionId).toBe("v");
  });

  it("creates greeting only when usable and applies reply strategies", () => {
    const thread = createRoleplayThread({
      id: "t",
      branchId: "b",
      title: "R",
      characterIds: ["a", "b"],
      activePersonaId: "p",
      openingCharacter: { id: "a", displayName: "Alice" },
      greetingText: "Hello",
      greetingMessageId: "m",
      greetingVersionId: "v",
      now: "2026-01-01",
      replyStrategy: "ordered",
    });
    expect(thread.messages).toHaveLength(1);
    expect(getNextRoleplayCompanion(thread, [character("a"), character("b")])?.id).toBe("b");
    const manual: RoleplayModeThread = {
      ...thread,
      branches: [{ ...thread.branches[0], replyStrategy: "manual" as const }],
    };
    expect(getNextRoleplayCompanion(manual, [character("a")])).toBeNull();
    const noGreeting = createRoleplayThread({
      id: "t2",
      branchId: "b2",
      title: "R",
      characterIds: ["a"],
      activePersonaId: null,
      openingCharacter: { id: "a", displayName: "Alice" },
      now: "2026-01-01",
    });
    expect(noGreeting.messages).toHaveLength(0);
    expect(() =>
      createRoleplayThread({
        id: "bad",
        branchId: "bad-branch",
        title: "R",
        characterIds: ["a"],
        activePersonaId: null,
        openingCharacter: { id: "a", displayName: "Alice" },
        greetingText: "Hi",
        greetingMessageId: "only",
        now: "2026-01-01",
      }),
    ).toThrow("required together");
    expect(() =>
      createRoleplayThread({
        id: "bad2",
        branchId: "bad2-branch",
        title: "R",
        characterIds: ["a"],
        activePersonaId: null,
        openingCharacter: { id: "b", displayName: "Bob" },
        now: "2026-01-01",
      }),
    ).toThrow("participant");
  });

  it("uses active messenger branch for next speaker", () => {
    const thread = createMessengerThread({
      id: "t",
      branchId: "b",
      title: "M",
      characterIds: ["a", "b"],
      activePersonaId: null,
      now: "2026-01-01",
    });
    expect(getNextMessengerCompanion(thread, [character("a"), character("b")])?.id).toBe("a");
  });

  it("supports a neutral manual system message", () => {
    const thread = createRoleplayThread({
      id: "t",
      branchId: "b",
      title: "R",
      characterIds: [],
      activePersonaId: null,
      openingCharacter: null,
      now: "2026-01-01",
    });
    expect(
      createSystemRoleplayMessage({
        thread,
        id: "m",
        versionId: "v",
        body: "note",
        now: "2026-01-01",
      }).author.kind,
    ).toBe("system");
  });

  it("rotates natural replies after a greeting and excludes system messages", () => {
    const thread = createRoleplayThread({
      id: "natural",
      branchId: "branch",
      title: "R",
      characterIds: ["a", "b"],
      activePersonaId: "p",
      openingCharacter: { id: "a", displayName: "a" },
      greetingText: "Hi",
      greetingMessageId: "g",
      greetingVersionId: "gv",
      now: "2026-01-01",
      replyStrategy: "natural",
    });
    expect(getNextRoleplayCompanion(thread, [character("a"), character("b")])?.id).toBe("b");
    const system = createSystemRoleplayMessage({
      thread,
      id: "s",
      versionId: "sv",
      body: "note",
      now: "2026-01-01",
    });
    const withSystem = appendRoleplayMessages(thread, [system]);
    expect(getNextRoleplayCompanion(withSystem, [character("a"), character("b")])?.id).toBe("b");
  });

  it("starts a new round-robin turn after a neutral system entry", () => {
    const thread = createRoleplayThread({
      id: "round-robin",
      branchId: "branch",
      title: "R",
      characterIds: ["a", "b"],
      activePersonaId: null,
      openingCharacter: null,
      now: "2026-01-01",
      replyStrategy: "round-robin",
    });
    const afterReplies = appendRoleplayMessages(thread, [
      createCompanionRoleplayMessage({
        thread,
        companion: character("a"),
        id: "a-reply",
        versionId: "a-version",
        body: "a",
        now: "2026-01-01",
      }),
      createCompanionRoleplayMessage({
        thread,
        companion: character("b"),
        id: "b-reply",
        versionId: "b-version",
        body: "b",
        now: "2026-01-01",
      }),
    ]);
    const neutralEntry = createSystemRoleplayMessage({
      thread: afterReplies,
      id: "scene",
      versionId: "scene-version",
      body: "The scene changes.",
      now: "2026-01-01",
    });

    expect(
      getNextRoleplayCompanion(appendRoleplayMessages(afterReplies, [neutralEntry]), [
        character("a"),
        character("b"),
      ])?.id,
    ).toBe("a");
  });

  it.each(["natural", "ordered"] as const)(
    "ignores removed participants when selecting the next %s reply",
    (replyStrategy) => {
      const thread = createRoleplayThread({
        id: replyStrategy,
        branchId: "branch",
        title: "R",
        characterIds: ["b", "c"],
        activePersonaId: null,
        openingCharacter: null,
        now: "2026-01-01",
        replyStrategy,
      });
      const removedParticipantMessage = createCompanionRoleplayMessage({
        thread,
        companion: character("a"),
        id: "removed-reply",
        versionId: "removed-version",
        body: "old",
        now: "2026-01-01",
      });

      expect(
        getNextRoleplayCompanion(appendRoleplayMessages(thread, [removedParticipantMessage]), [
          character("b"),
          character("c"),
        ])?.id,
      ).toBe("b");
    },
  );

  it("keeps message mutations isolated to the active branch", () => {
    const thread = createMessengerThread({
      id: "t",
      branchId: "active",
      title: "M",
      characterIds: ["a"],
      activePersonaId: null,
      now: "2026-01-01",
    });
    const message = createPersonaMessengerMessage({
      thread,
      persona,
      id: "m",
      versionId: "v",
      body: "hi",
      now: "2026-01-01",
    });
    const appended = appendMessengerMessages(thread, [message]);
    expect(appended.messages).toHaveLength(1);
    expect(deleteMessengerMessage(appended, "m").messages).toHaveLength(0);
    const roleplay = createRoleplayThread({
      id: "r",
      branchId: "rb",
      title: "R",
      characterIds: ["a"],
      activePersonaId: null,
      openingCharacter: null,
      now: "2026-01-01",
    });
    const roleplayMessage = createCompanionRoleplayMessage({
      thread: roleplay,
      companion: character("a"),
      id: "x",
      versionId: "xv",
      body: "x",
      now: "2026-01-01",
    });
    expect(
      deleteRoleplayMessage(appendRoleplayMessages(roleplay, [roleplayMessage]), "x").messages,
    ).toHaveLength(0);
  });

  it("appends to an explicit branch without changing the active branch", () => {
    const thread = createMessengerThread({
      id: "explicit-branch",
      branchId: "active",
      title: "M",
      characterIds: ["a"],
      activePersonaId: null,
      now: "2026-01-01",
    });
    const otherBranch = { ...thread.branches[0], id: "other" };
    const source: MessengerModeThread = {
      ...thread,
      branches: [...thread.branches, otherBranch],
      activeBranchId: "other",
    };
    const message = createPersonaMessengerMessage({
      thread: source,
      persona,
      id: "explicit-message",
      versionId: "explicit-version",
      body: "hello",
      now: "2026-01-01",
    });

    const target: MessengerModeThread = { ...thread, branches: [...thread.branches, otherBranch] };
    const appended = appendMessengerMessages(target, [message], "other");
    expect(appended.activeBranchId).toBe("active");
    expect(appended.messages[0]?.branchId).toBe("other");
  });
});
