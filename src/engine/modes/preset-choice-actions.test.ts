import { describe, expect, it } from "vitest";
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

const STARTED_AT = "2026-07-09T00:00:00.000Z";
const UPDATED_AT = "2026-07-09T00:01:00.000Z";

describe("thread prompt preset choice selections", () => {
  it("atomically confirms a Messenger target preset with normalized history", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-atomic",
        now: STARTED_AT,
        title: "Messenger",
      }),
      presetId: "preset-old",
      presetChoiceSelectionsByPresetId: {
        "preset-old": { old: { kind: "option" as const, optionId: "old" } },
      },
    };
    const updated = setMessengerThreadPreset(thread, " preset-new ", UPDATED_AT, {
      " choice-tone ": { kind: "option", optionId: " tone-warm " },
    });

    expect(updated.presetId).toBe("preset-new");
    expect(updated.presetChoiceSelectionsByPresetId).toEqual({
      "preset-old": { old: { kind: "option", optionId: "old" } },
      "preset-new": { "choice-tone": { kind: "option", optionId: "tone-warm" } },
    });
    expect(thread.presetId).toBe("preset-old");
    expect(
      (thread.presetChoiceSelectionsByPresetId as Record<string, unknown>)["preset-new"],
    ).toBeUndefined();
  });

  it("atomically confirms a Roleplay target preset and preserves prior history", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-atomic",
        now: STARTED_AT,
        title: "Roleplay",
      }),
      presetId: "preset-old",
      presetChoiceSelectionsByPresetId: {
        "preset-old": { old: { kind: "option" as const, optionId: "old" } },
      },
    };
    const updated = setRoleplayThreadPreset(thread, "preset-new", UPDATED_AT, {
      " choice-tone ": { kind: "option", optionId: " tone-warm " },
    });

    expect(updated.presetId).toBe("preset-new");
    expect(updated.presetChoiceSelectionsByPresetId).toEqual({
      "preset-old": { old: { kind: "option", optionId: "old" } },
      "preset-new": { "choice-tone": { kind: "option", optionId: "tone-warm" } },
    });
    expect(thread.presetId).toBe("preset-old");
    expect(
      (thread.presetChoiceSelectionsByPresetId as Record<string, unknown>)["preset-new"],
    ).toBeUndefined();
  });

  it("stores only native stable Messenger prompt preset choices", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-1",
      now: STARTED_AT,
      defaultPromptPresetId: "preset-1",
      title: "Messenger",
    });

    const updated = setMessengerThreadPresetChoiceSelections(
      thread,
      {
        " choice-tone ": { kind: "option", optionId: " tone-dramatic " },
      },
      UPDATED_AT,
    );

    expect(updated.presetChoiceSelectionsByPresetId!["preset-1"]).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-dramatic" },
    });
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(thread.presetChoiceSelectionsByPresetId).toEqual({});
  });

  it("replaces Roleplay prompt preset choices atomically", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-1",
        now: STARTED_AT,
        defaultPromptPresetId: "preset-1",
        title: "Roleplay",
      }),
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-style": { kind: "option" as const, optionId: "style-noir" },
        },
      },
    };

    const updated = setRoleplayThreadPresetChoiceSelections(thread, {}, UPDATED_AT);

    expect(updated.presetChoiceSelectionsByPresetId!["preset-1"]).toEqual({});
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(thread.presetChoiceSelectionsByPresetId["preset-1"]).toEqual({
      "choice-style": { kind: "option", optionId: "style-noir" },
    });
  });

  it("stores trimmed multi-value selections for future preset-variable controls", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-1",
      now: STARTED_AT,
      defaultPromptPresetId: "preset-1",
      title: "Roleplay",
    });

    const updated = setRoleplayThreadPresetChoiceSelections(
      thread,
      {
        "choice-tags": [
          { kind: "option", optionId: " first " },
          { kind: "option", optionId: "" },
          { kind: "option", optionId: "second" },
        ],
      },
      UPDATED_AT,
    );

    expect(updated.presetChoiceSelectionsByPresetId!["preset-1"]).toEqual({
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
        now: STARTED_AT,
        title: "Roleplay",
      }),
      presetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-tone": { kind: "option" as const, optionId: "tone-quiet" },
        },
      },
    };

    const updated = setRoleplayThreadPreset(thread, " preset-1 ", UPDATED_AT);

    expect(updated).toBe(thread);
    expect(updated.presetChoiceSelectionsByPresetId!["preset-1"]).toEqual({
      "choice-tone": { kind: "option", optionId: "tone-quiet" },
    });
    expect(updated.updatedAt).toBe(STARTED_AT);
  });

  it("resets prompt preset choices when changing presets", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-1",
        now: STARTED_AT,
        title: "Roleplay",
      }),
      presetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-tone": { kind: "option" as const, optionId: "tone-quiet" },
        },
      },
    };

    const updated = setRoleplayThreadPreset(thread, "preset-2", UPDATED_AT);

    expect(updated.presetId).toBe("preset-2");
    expect(updated.presetChoiceSelectionsByPresetId!["preset-2"]).toEqual(undefined);
    expect(updated.updatedAt).toBe(UPDATED_AT);
  });

  it("preserves Messenger prompt preset choices when setting the same preset", () => {
    const thread = {
      ...createMessengerThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "messenger-1",
        now: STARTED_AT,
        title: "Messenger",
      }),
      presetId: "preset-1",
      presetChoiceSelectionsByPresetId: {
        "preset-1": {
          "choice-style": { kind: "option" as const, optionId: "style-crisp" },
        },
      },
    };

    const updated = setMessengerThreadPreset(thread, "preset-1", UPDATED_AT);

    expect(updated).toBe(thread);
    expect(updated.presetChoiceSelectionsByPresetId!["preset-1"]).toEqual({
      "choice-style": { kind: "option", optionId: "style-crisp" },
    });
    expect(updated.updatedAt).toBe(STARTED_AT);
  });
});
