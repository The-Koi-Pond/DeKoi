import { describe, expect, it } from "vitest";
import type { MessengerModeThread, RoleplayModeThread } from "../contracts/types/mode-thread";
import {
  createMessengerThread,
  setMessengerThreadPreset,
  setMessengerThreadPresetChoiceSelections,
} from "./messenger/messenger-actions";
import {
  createRoleplayThread,
  setRoleplayThreadPreset,
  setRoleplayThreadPresetChoiceSelections,
} from "./roleplay/roleplay-actions";
import { getActiveModeBranch } from "./mode-thread/mode-thread-actions";

const STARTED_AT = "2026-07-09T00:00:00.000Z";
const UPDATED_AT = "2026-07-09T00:01:00.000Z";

describe("thread prompt preset choice selections", () => {
  it("atomically confirms a Messenger target preset with normalized history", () => {
    const created = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-atomic",
      branchId: "messenger-atomic-branch",
      now: STARTED_AT,
      title: "Messenger",
    });
    const thread: MessengerModeThread = {
      ...created,
      branches: [
        {
          ...created.branches[0],
          presetId: "preset-old",
          presetChoiceSelectionsByPresetId: {
            "preset-old": { old: { kind: "option" as const, optionId: "old" } },
          },
        },
      ],
    };
    const updated = setMessengerThreadPreset(thread, " preset-new ", UPDATED_AT, {
      " choice-tone ": { kind: "option", optionId: " tone-warm " },
    });

    expect(getActiveModeBranch(updated).presetId).toBe("preset-new");
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId).toEqual({
      "preset-old": { old: { kind: "option", optionId: "old" } },
      "preset-new": { "choice-tone": { kind: "option", optionId: "tone-warm" } },
    });
    expect(getActiveModeBranch(thread).presetId).toBe("preset-old");
    expect(
      (getActiveModeBranch(thread).presetChoiceSelectionsByPresetId as Record<string, unknown>)[
        "preset-new"
      ],
    ).toBeUndefined();
  });

  it("atomically confirms a Roleplay target preset and preserves prior history", () => {
    const created = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-atomic",
      branchId: "roleplay-atomic-branch",
      openingCharacter: null,
      now: STARTED_AT,
      title: "Roleplay",
    });
    const thread: RoleplayModeThread = {
      ...created,
      branches: [
        {
          ...created.branches[0],
          presetId: "preset-old",
          presetChoiceSelectionsByPresetId: {
            "preset-old": { old: { kind: "option" as const, optionId: "old" } },
          },
        },
      ],
    };
    const updated = setRoleplayThreadPreset(thread, "preset-new", UPDATED_AT, {
      " choice-tone ": { kind: "option", optionId: " tone-warm " },
    });

    expect(getActiveModeBranch(updated).presetId).toBe("preset-new");
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId).toEqual({
      "preset-old": { old: { kind: "option", optionId: "old" } },
      "preset-new": { "choice-tone": { kind: "option", optionId: "tone-warm" } },
    });
    expect(getActiveModeBranch(thread).presetId).toBe("preset-old");
    expect(
      (getActiveModeBranch(thread).presetChoiceSelectionsByPresetId as Record<string, unknown>)[
        "preset-new"
      ],
    ).toBeUndefined();
  });

  it("stores only native stable Messenger prompt preset choices", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-1",
      branchId: "messenger-1-branch",
      now: STARTED_AT,
      title: "Messenger",
    });
    const seeded = setMessengerThreadPreset(thread, "preset-1", STARTED_AT);

    const updated = setMessengerThreadPresetChoiceSelections(
      seeded,
      {
        " choice-tone ": { kind: "option", optionId: " tone-dramatic " },
      },
      UPDATED_AT,
    );

    expect(getActiveModeBranch(updated).presetId).toBe("preset-1");
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-dramatic" },
    });
    expect(getActiveModeBranch(updated).updatedAt).toBe(UPDATED_AT);
    expect(getActiveModeBranch(thread).presetChoiceSelectionsByPresetId).toEqual({});
  });

  it("replaces Roleplay prompt preset choices atomically", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-1",
      branchId: "roleplay-1-branch",
      openingCharacter: null,
      now: STARTED_AT,
      title: "Roleplay",
    });
    const seeded = setRoleplayThreadPresetChoiceSelections(
      setRoleplayThreadPreset(thread, "preset-1", STARTED_AT),
      { "choice-style": { kind: "option", optionId: "style-noir" } },
      STARTED_AT,
    );

    const updated = setRoleplayThreadPresetChoiceSelections(seeded, {}, UPDATED_AT);

    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({});
    expect(getActiveModeBranch(updated).updatedAt).toBe(UPDATED_AT);
    expect(getActiveModeBranch(seeded).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-style": { kind: "option", optionId: "style-noir" },
    });
  });

  it("stores trimmed multi-value selections for future preset-variable controls", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-1",
      branchId: "roleplay-1-branch",
      openingCharacter: null,
      now: STARTED_AT,
      title: "Roleplay",
    });
    const seeded = setRoleplayThreadPreset(thread, "preset-1", STARTED_AT);

    const updated = setRoleplayThreadPresetChoiceSelections(
      seeded,
      {
        "choice-tags": [
          { kind: "option", optionId: " first " },
          { kind: "option", optionId: "" },
          { kind: "option", optionId: "second" },
        ],
      },
      UPDATED_AT,
    );

    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-tags": [
        { kind: "option", optionId: "first" },
        { kind: "option", optionId: "second" },
      ],
    });
  });

  it("preserves Roleplay prompt preset choices when setting the same preset", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-1",
        branchId: "roleplay-1-branch",
        openingCharacter: null,
        now: STARTED_AT,
        title: "Roleplay",
      }),
    };
    const seeded = setRoleplayThreadPresetChoiceSelections(
      setRoleplayThreadPreset(thread, "preset-1", STARTED_AT),
      { "choice-tone": { kind: "option", optionId: "tone-quiet" } },
      STARTED_AT,
    );

    const updated = setRoleplayThreadPreset(seeded, " preset-1 ", UPDATED_AT);

    expect(updated).toBe(seeded);
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-quiet" },
    });
    expect(getActiveModeBranch(updated).updatedAt).toBe(STARTED_AT);
  });

  it("resets prompt preset choices when changing presets", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-1",
        branchId: "roleplay-1-branch",
        openingCharacter: null,
        now: STARTED_AT,
        title: "Roleplay",
      }),
    };
    const seeded = setRoleplayThreadPresetChoiceSelections(
      setRoleplayThreadPreset(thread, "preset-1", STARTED_AT),
      { "choice-tone": { kind: "option", optionId: "tone-quiet" } },
      STARTED_AT,
    );

    const updated = setRoleplayThreadPreset(seeded, "preset-2", UPDATED_AT);

    expect(getActiveModeBranch(updated).presetId).toBe("preset-2");
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-2"]).toEqual(
      undefined,
    );
    expect(getActiveModeBranch(updated).updatedAt).toBe(UPDATED_AT);
  });

  it("preserves Messenger prompt preset choices when setting the same preset", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-1",
        branchId: "messenger-1-branch",
        now: STARTED_AT,
        title: "Messenger",
      }),
    };
    const seeded = setMessengerThreadPresetChoiceSelections(
      setMessengerThreadPreset(thread, "preset-1", STARTED_AT),
      { "choice-style": { kind: "option", optionId: "style-crisp" } },
      STARTED_AT,
    );

    const updated = setMessengerThreadPreset(seeded, "preset-1", UPDATED_AT);

    expect(updated).toBe(seeded);
    expect(getActiveModeBranch(updated).presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-style": { kind: "option", optionId: "style-crisp" },
    });
    expect(updated.updatedAt).toBe(STARTED_AT);
  });
});
