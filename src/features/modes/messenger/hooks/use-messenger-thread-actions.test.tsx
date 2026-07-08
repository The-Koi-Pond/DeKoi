import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type {
  MessengerMessage,
  MessengerThread,
} from "../../../../engine/contracts/types/messenger";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { useMessengerThreadActions } from "./use-messenger-thread-actions";

function character(id: string): CharacterRecord {
  return {
    id,
    displayName: "Companion",
    firstMessage: "",
    lorebookIds: ["character-lore"],
  } as CharacterRecord;
}

function providerConnection(id: string): ProviderConnectionRecord {
  return { id } as ProviderConnectionRecord;
}

function messengerMessage(id: string): MessengerMessage {
  return { id, body: `Message ${id}` } as MessengerMessage;
}

function messengerThread(input: Partial<MessengerThread> = {}): MessengerThread {
  return {
    id: "messenger-thread-1",
    schemaVersion: 1,
    kind: "messenger",
    mode: "direct",
    title: "Messenger",
    characterIds: ["character-1"],
    activePersonaId: null,
    lorebookIds: [],
    presetId: null,
    providerConnectionId: null,
    systemPromptMode: "default",
    systemPrompt: "",
    messages: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  } as MessengerThread;
}

function createStateSetter<T>(state: { current: T }): StateSetter<T> {
  return (nextState) => {
    state.current =
      typeof nextState === "function"
        ? (nextState as (currentState: T) => T)(state.current)
        : nextState;
  };
}

function captureMessengerThreadActions(initialMessengerThreads: MessengerThread[] = []) {
  const messengerThreads = { current: initialMessengerThreads };
  const loreRuntimeStates = { current: [] as LoreRuntimeState[] };
  const macroVariableStates = { current: [] as MacroVariableScope[] };
  const actions = { current: null as ReturnType<typeof useMessengerThreadActions> | null };

  function Capture() {
    actions.current = useMessengerThreadActions({
      activeMessengerConnectionId: "connection-1",
      characters: [character("character-1")],
      messengerThreads: messengerThreads.current,
      personas: [],
      providerConnections: [providerConnection("connection-1")],
      setMessengerThreads: createStateSetter(messengerThreads),
      setLoreRuntimeStates: createStateSetter(loreRuntimeStates),
      setMacroVariableStates: createStateSetter(macroVariableStates),
      setView: () => {},
      view: { kind: "pond" },
      openMessengerThread: () => {},
    });
    return null;
  }

  renderToStaticMarkup(<Capture />);

  if (!actions.current) {
    throw new Error("Messenger thread actions were not captured.");
  }

  return {
    actions: actions.current,
    messengerThreads,
  };
}

describe("useMessengerThreadActions", () => {
  it("appends generated Messenger messages to the latest thread state", () => {
    const userMessage = messengerMessage("user-message");
    const generatedMessage = messengerMessage("generated-message");
    const currentThread = messengerThread({
      messages: [userMessage],
      presetId: null,
      title: "Edited while generating",
    });
    const { actions, messengerThreads } = captureMessengerThreadActions([currentThread]);

    actions.appendMessengerThreadMessages(currentThread.id, [generatedMessage]);

    expect(messengerThreads.current[0]).toMatchObject({
      id: currentThread.id,
      presetId: null,
      title: "Edited while generating",
    });
    expect(messengerThreads.current[0]?.messages.map((message) => message.id)).toEqual([
      "user-message",
      "generated-message",
    ]);
  });
});
