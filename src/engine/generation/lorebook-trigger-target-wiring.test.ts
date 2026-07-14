import { describe, expect, it } from "vitest";

import {
  LOREBOOK_GENERATION_TEST_NOW as now,
  lorebookGenerationCharacter as character,
  messengerMessageFixture as messengerMessage,
  messengerThreadFixture as messengerThread,
  roleplayMessageFixture as roleplayMessage,
  roleplayThreadFixture as roleplayThread,
  selectiveLorebookFixture as selectiveLorebook,
} from "./lorebook-generation-wiring-fixtures";
import {
  createMessengerGenerationContext,
  createMessengerGenerationRequest,
} from "./messenger-generation";
import {
  createRoleplayGenerationContext,
  createRoleplayGenerationRequest,
} from "./roleplay-generation";

describe("lorebook trigger and selected-target generation wiring", () => {
  it("uses the Messenger ordinary-send trigger and selected group reply target", () => {
    const mara = character({ id: "character-1", displayName: "Mara" });
    const ivo = character({ id: "character-2", displayName: "Ivo" });
    const thread = messengerThread({
      id: "messenger-thread-1",
      title: "Group thread",
      characterIds: [mara.id, ivo.id],
      activePersonaId: null,
      lorebookIds: ["group-lore"],
      providerConnectionId: null,
      messages: [messengerMessage("message-1", "Tell me about the canal.")],
    });
    const context = createMessengerGenerationContext({
      thread,
      characters: [mara, ivo],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "group-lore",
          title: "Group Lore",
          entries: [
            {
              id: "mara-normal",
              title: "Mara normal",
              body: "Mara knows the canal route.",
              key: ["canal"],
              input: {
                triggers: { types: ["normal"] },
                characterFilter: { mode: "include", characterIds: [mara.id] },
              },
            },
            {
              id: "ivo-normal",
              title: "Ivo normal",
              body: "Ivo knows the canal route.",
              key: ["canal"],
              input: {
                triggers: { types: ["normal"] },
                characterFilter: { mode: "include", characterIds: [ivo.id] },
              },
            },
            {
              id: "mara-regenerate",
              title: "Mara regenerate",
              body: "Mara regeneration-only lore.",
              key: ["canal"],
              input: {
                triggers: { types: ["regenerate"] },
                characterFilter: { mode: "include", characterIds: [mara.id] },
              },
            },
          ],
        }),
      ],
    });

    const request = createMessengerGenerationRequest({
      context,
      id: "request-1",
      now,
      userMessage: thread.messages[0],
    });
    const promptText = request.promptMessages.map((message) => message.content).join("\n");

    expect(request.targetCharacterId).toBe(mara.id);
    expect(promptText).toContain("Mara knows the canal route.");
    expect(promptText).not.toContain("Ivo knows the canal route.");
    expect(promptText).not.toContain("Mara regeneration-only lore.");
  });

  it("uses the Roleplay selected group reply target for character filters", () => {
    const mara = character({ id: "character-1", displayName: "Mara" });
    const ivo = character({ id: "character-2", displayName: "Ivo" });
    const thread = roleplayThread({
      id: "roleplay-thread-1",
      title: "Group scene",
      characterIds: [mara.id, ivo.id],
      activePersonaId: null,
      lorebookIds: ["group-lore"],
      providerConnectionId: null,
      replyStrategy: "ordered",
      messages: [roleplayMessage("entry-1", "We reach the canal.")],
    });
    const context = createRoleplayGenerationContext({
      thread,
      characters: [mara, ivo],
      personas: [],
      lorebooks: [
        selectiveLorebook({
          id: "group-lore",
          title: "Group Lore",
          entries: [
            {
              id: "mara",
              title: "Mara",
              body: "Mara recognizes the canal.",
              key: ["canal"],
              input: {
                characterFilter: { mode: "include", characterIds: [mara.id] },
              },
            },
            {
              id: "ivo",
              title: "Ivo",
              body: "Ivo recognizes the canal.",
              key: ["canal"],
              input: {
                characterFilter: { mode: "include", characterIds: [ivo.id] },
              },
            },
          ],
        }),
      ],
    });

    const request = createRoleplayGenerationRequest({ context, id: "request-1", now });
    const promptText = request.promptMessages.map((message) => message.content).join("\n");

    expect(request.targetCharacterId).toBe(mara.id);
    expect(promptText).toContain("Mara recognizes the canal.");
    expect(promptText).not.toContain("Ivo recognizes the canal.");
  });
});
