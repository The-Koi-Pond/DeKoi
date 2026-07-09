import { describe, expect, it } from "vitest";
import {
  createMessengerThread,
  setMessengerThreadPreset,
  setMessengerThreadPresetChoiceSelection,
} from "./messenger/messenger-actions";
import {
  createRoleplayThread,
  setRoleplayThreadPreset,
  setRoleplayThreadPresetChoiceSelection,
} from "./roleplay/roleplay-actions";

const STARTED_AT = "2026-07-09T00:00:00.000Z";
const UPDATED_AT = "2026-07-09T00:01:00.000Z";

describe("thread prompt preset choice selections", () => {
  it("sets and trims a Messenger prompt preset choice", () => {
    const thread = createMessengerThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "messenger-1",
      now: STARTED_AT,
      title: "Messenger",
    });

    const updated = setMessengerThreadPresetChoiceSelection(
      thread,
      " tone ",
      " dramatic ",
      UPDATED_AT,
    );

    expect(updated.presetChoiceSelections).toEqual({ tone: "dramatic" });
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(thread.presetChoiceSelections).toEqual({});
  });

  it("removes an empty Roleplay prompt preset choice without dropping other choices", () => {
    const thread = {
      ...createRoleplayThread({
        activePersonaId: null,
        characterIds: ["character-1"],
        id: "roleplay-1",
        now: STARTED_AT,
        title: "Roleplay",
      }),
      presetChoiceSelections: {
        style: "noir",
        tone: "dramatic",
      },
    };

    const updated = setRoleplayThreadPresetChoiceSelection(thread, " tone ", " ", UPDATED_AT);

    expect(updated.presetChoiceSelections).toEqual({ style: "noir" });
    expect(updated.updatedAt).toBe(UPDATED_AT);
    expect(thread.presetChoiceSelections).toEqual({
      style: "noir",
      tone: "dramatic",
    });
  });

  it("stores trimmed multi-value selections for future preset-variable controls", () => {
    const thread = createRoleplayThread({
      activePersonaId: null,
      characterIds: ["character-1"],
      id: "roleplay-1",
      now: STARTED_AT,
      title: "Roleplay",
    });

    const updated = setRoleplayThreadPresetChoiceSelection(
      thread,
      "tags",
      [" first ", "", "second"],
      UPDATED_AT,
    );

    expect(updated.presetChoiceSelections).toEqual({ tags: ["first", "second"] });
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
      presetChoiceSelections: {
        tone: "quiet",
      },
    };

    const updated = setRoleplayThreadPreset(thread, " preset-1 ", UPDATED_AT);

    expect(updated).toBe(thread);
    expect(updated.presetChoiceSelections).toEqual({ tone: "quiet" });
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
      presetChoiceSelections: {
        tone: "quiet",
      },
    };

    const updated = setRoleplayThreadPreset(thread, "preset-2", UPDATED_AT);

    expect(updated.presetId).toBe("preset-2");
    expect(updated.presetChoiceSelections).toEqual({});
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
      presetChoiceSelections: {
        style: "crisp",
      },
    };

    const updated = setMessengerThreadPreset(thread, "preset-1", UPDATED_AT);

    expect(updated).toBe(thread);
    expect(updated.presetChoiceSelections).toEqual({ style: "crisp" });
    expect(updated.updatedAt).toBe(STARTED_AT);
  });
});
