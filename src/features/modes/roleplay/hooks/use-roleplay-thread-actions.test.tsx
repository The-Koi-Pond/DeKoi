import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CharacterRecord } from "../../../../engine/contracts/types/character";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type { ProviderConnectionRecord } from "../../../../engine/contracts/types/provider-connection";
import type { RoleplayEntry, RoleplayThread } from "../../../../engine/contracts/types/roleplay";
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

function roleplayEntry(id: string): RoleplayEntry {
  return { id, body: `Entry ${id}` } as RoleplayEntry;
}

function roleplayThread(input: Partial<RoleplayThread> = {}): RoleplayThread {
  return {
    id: "roleplay-thread-1",
    schemaVersion: 1,
    kind: "roleplay",
    title: "Roleplay",
    characterIds: ["character-1"],
    activePersonaId: null,
    lorebookIds: [],
    presetId: null,
    providerConnectionId: null,
    entries: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...input,
  } as RoleplayThread;
}

function createStateSetter<T>(state: { current: T }): StateSetter<T> {
  return (nextState) => {
    state.current =
      typeof nextState === "function"
        ? (nextState as (currentState: T) => T)(state.current)
        : nextState;
  };
}

function captureRoleplayThreadActions(initialRoleplayThreads: RoleplayThread[] = []) {
  const roleplayThreads = { current: initialRoleplayThreads };
  const loreRuntimeStates = { current: [] as LoreRuntimeState[] };
  const macroVariableStates = { current: [] as MacroVariableScope[] };
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
      setMacroVariableStates: createStateSetter(macroVariableStates),
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

  it("appends generated Roleplay entries to the latest thread state", () => {
    const userEntry = roleplayEntry("user-entry");
    const generatedEntry = roleplayEntry("generated-entry");
    const currentThread = roleplayThread({
      entries: [userEntry],
      presetId: null,
      title: "Edited while generating",
    });
    const { actions, roleplayThreads } = captureRoleplayThreadActions([currentThread]);

    actions.appendRoleplayThreadEntries(currentThread.id, [generatedEntry]);

    expect(roleplayThreads.current[0]).toMatchObject({
      id: currentThread.id,
      presetId: null,
      title: "Edited while generating",
    });
    expect(roleplayThreads.current[0]?.entries.map((entry) => entry.id)).toEqual([
      "user-entry",
      "generated-entry",
    ]);
  });
});
