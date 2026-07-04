import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { RoleplayThread } from "../../../../engine/contracts/types/roleplay";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { useRoleplayThreadActions } from "./use-roleplay-thread-actions";

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

function createStateSetter<T>(state: { current: T }): StateSetter<T> {
  return (nextState) => {
    state.current =
      typeof nextState === "function"
        ? (nextState as (currentState: T) => T)(state.current)
        : nextState;
  };
}

function captureRoleplayThreadActions() {
  const roleplayThreads = { current: [] as RoleplayThread[] };
  const loreRuntimeStates = { current: [] as LoreRuntimeState[] };
  const rippleStates = { current: [] as RippleState[] };
  const actions = { current: null as ReturnType<typeof useRoleplayThreadActions> | null };
  let openedThreadId: string | null = null;

  function Capture() {
    actions.current = useRoleplayThreadActions({
      activeMessengerConnectionId: "connection-1",
      characters: [character("character-1")],
      roleplayThreads: roleplayThreads.current,
      personas: [],
      providerConnections: [providerConnection("connection-1")],
      setRoleplayThreads: createStateSetter(roleplayThreads),
      setLoreRuntimeStates: createStateSetter(loreRuntimeStates),
      setRippleStates: createStateSetter(rippleStates),
      setView: () => {},
      view: { kind: "pond" },
      openRoleplayThread: (threadId) => {
        openedThreadId = threadId;
      },
    });
    return null;
  }

  renderToStaticMarkup(<Capture />);

  if (!actions.current) {
    throw new Error("Roleplay thread actions were not captured.");
  }

  return {
    actions: actions.current,
    roleplayThreads,
    get openedThreadId() {
      return openedThreadId;
    },
  };
}

describe("useRoleplayThreadActions", () => {
  it("creates default Roleplay threads without chat lorebook IDs", () => {
    const captured = captureRoleplayThreadActions();

    const thread = captured.actions.createRoleplayThread();

    expect(thread.lorebookIds).toEqual([]);
    expect(captured.roleplayThreads.current[0]?.lorebookIds).toEqual([]);
    expect(captured.openedThreadId).toBe(thread.id);
  });

  it("preserves explicit Roleplay thread lorebook IDs", () => {
    const { actions } = captureRoleplayThreadActions();

    const thread = actions.createRoleplayThread({
      lorebookIds: [" explicit-lore ", "explicit-lore", ""],
    });

    expect(thread.lorebookIds).toEqual(["explicit-lore"]);
  });
});
