import { describe, expect, it } from "vitest";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { PromptPresetRecord } from "../../../engine/contracts/types/prompt-presets";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import {
  getThreadReferenceNotices,
  getThreadReferenceSummary,
  getThreadSendBlocker,
  type ThreadReferenceRecord,
} from "./thread-reference-summary";

function character(id: string, lorebookIds: string[]): CharacterRecord {
  return { id, lorebookIds } as CharacterRecord;
}

function lorebook(id: string): LorebookRecord {
  return { id } as LorebookRecord;
}

function persona(id: string, lorebookIds: string[]): PersonaRecord {
  return { id, lorebookIds } as PersonaRecord;
}

function providerConnection(id: string): ProviderConnectionRecord {
  return { id } as ProviderConnectionRecord;
}

function promptPreset(id: string): PromptPresetRecord {
  return { id } as PromptPresetRecord;
}

function variablePromptPreset(id: string): PromptPresetRecord {
  return {
    id,
    choiceBlocks: [
      {
        id: "choice",
        variableName: "tone",
        options: [{ id: "warm", label: "Warm", value: "warm" }],
      },
    ],
  } as PromptPresetRecord;
}

function thread(input: Partial<ThreadReferenceRecord> = {}): ThreadReferenceRecord {
  return {
    activePersonaId: null,
    characterIds: [],
    lorebookIds: [],
    presetId: null,
    providerConnectionId: "connection",
    ...input,
  };
}

describe("getThreadReferenceSummary", () => {
  it("counts missing lorebooks across chat, persona, character, and global sources", () => {
    const summary = getThreadReferenceSummary({
      characters: [character("companion", ["saved-character-lore", "missing-character-lore"])],
      fallbackProviderConnectionId: "connection",
      globalLorebookIds: ["saved-global-lore", "missing-global-lore"],
      lorebooks: [
        lorebook("saved-character-lore"),
        lorebook("saved-chat-lore"),
        lorebook("saved-global-lore"),
        lorebook("saved-persona-lore"),
      ],
      personas: [persona("persona", ["saved-persona-lore", "missing-persona-lore"])],
      promptPresets: [],
      providerConnections: [providerConnection("connection")],
      thread: thread({
        activePersonaId: "persona",
        characterIds: ["companion"],
        lorebookIds: ["saved-chat-lore", "missing-chat-lore"],
      }),
    });

    expect(summary.missingLorebookCount).toBe(4);
  });

  it("does not warn when the selected prompt preset exists", () => {
    const summary = getThreadReferenceSummary({
      characters: [],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset("preset-1")],
      providerConnections: [providerConnection("connection")],
      thread: thread({ presetId: "preset-1" }),
    });

    expect(summary.hasMissingPreset).toBe(false);
  });

  it("warns when the selected prompt preset is missing", () => {
    const summary = getThreadReferenceSummary({
      characters: [],
      lorebooks: [],
      personas: [],
      promptPresets: [promptPreset("preset-1")],
      providerConnections: [providerConnection("connection")],
      thread: thread({ presetId: "missing-preset" }),
    });

    expect(summary.hasMissingPreset).toBe(true);
  });

  it("treats an empty history as confirmed but a missing history key as unconfirmed", () => {
    const base = {
      characters: [],
      lorebooks: [],
      personas: [],
      promptPresets: [variablePromptPreset("preset-1")],
      providerConnections: [providerConnection("connection")],
    };
    expect(
      getThreadReferenceSummary({
        ...base,
        thread: thread({
          presetId: "preset-1",
          presetChoiceSelectionsByPresetId: {},
        }),
      }).hasUnconfirmedPresetChoices,
    ).toBe(true);
    expect(
      getThreadReferenceSummary({
        ...base,
        thread: thread({
          presetId: "preset-1",
          presetChoiceSelectionsByPresetId: { "preset-1": {} },
        }),
      }).hasUnconfirmedPresetChoices,
    ).toBe(false);
  });

  it("blocks sending before transcript mutation when preset choices are unconfirmed", () => {
    const summary = getThreadReferenceSummary({
      characters: [],
      lorebooks: [],
      personas: [],
      promptPresets: [variablePromptPreset("preset-1")],
      providerConnections: [providerConnection("connection")],
      thread: thread({ presetId: "preset-1" }),
    });
    expect(summary.hasUnconfirmedPresetChoices).toBe(true);
    expect(getThreadReferenceNotices(summary, { surfaceLabel: "Messenger" })).toContainEqual(
      expect.objectContaining({ id: "preset-choices-unconfirmed" }),
    );
    expect(getThreadSendBlocker(summary, { surfaceLabel: "Messenger" })).toContain("Confirm");
  });
});
