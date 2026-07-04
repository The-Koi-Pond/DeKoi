import { describe, expect, it } from "vitest";
import type { CharacterRecord } from "../../../engine/contracts/types/character";
import type { LorebookRecord } from "../../../engine/contracts/types/lorebook";
import type { PersonaRecord } from "../../../engine/contracts/types/persona";
import type { ProviderConnectionRecord } from "../../../engine/contracts/types/provider-connection";
import { getThreadReferenceSummary, type ThreadReferenceRecord } from "./thread-reference-summary";

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

function thread(input: Partial<ThreadReferenceRecord> = {}): ThreadReferenceRecord {
  return {
    activePersonaId: null,
    characterIds: [],
    lorebookIds: [],
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
      providerConnections: [providerConnection("connection")],
      thread: thread({
        activePersonaId: "persona",
        characterIds: ["companion"],
        lorebookIds: ["saved-chat-lore", "missing-chat-lore"],
      }),
    });

    expect(summary.missingLorebookCount).toBe(4);
  });
});
