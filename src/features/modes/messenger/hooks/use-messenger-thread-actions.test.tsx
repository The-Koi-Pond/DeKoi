import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ModeThread,
  MessengerModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import { createMessengerThread } from "../../../../engine/modes/messenger/messenger-actions";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import type { StateSetter } from "../../../../shared/react/state-setter";
import { useMessengerThreadActions } from "./use-messenger-thread-actions";

const setState =
  <T,>(state: { current: T }): StateSetter<T> =>
  (next) => {
    state.current = typeof next === "function" ? (next as (value: T) => T)(state.current) : next;
  };
function capture(modeThreads: ModeThread[]) {
  const threads = { current: modeThreads },
    lore = { current: [] as LoreRuntimeState[] },
    macro = { current: [] as MacroVariableScope[] },
    ripple = { current: [] as RippleState[] };
  const captured: { value: ReturnType<typeof useMessengerThreadActions> | null } = { value: null };
  function Capture() {
    captured.value = useMessengerThreadActions({
      activeMessengerConnectionId: "c",
      characters: [],
      modeThreads: threads.current,
      personas: [],
      providerConnections: [],
      setModeThreads: (next) => {
        threads.current = typeof next === "function" ? next(threads.current) : next;
      },
      setLoreRuntimeStates: setState(lore),
      setMacroVariableStates: setState(macro),
      setRippleStates: setState(ripple),
      setView: () => {},
      view: { kind: "pond" },
      openChatSettings: () => {},
      openMessengerThread: () => {},
    });
    return null;
  }
  renderToStaticMarkup(<Capture />);
  const actions = captured.value;
  if (!actions) throw new Error("not captured");
  return { actions, threads };
}
const messenger = (id = "m") =>
  createMessengerThread({
    id,
    branchId: `${id}-branch`,
    title: id,
    characterIds: [],
    activePersonaId: null,
    now: "2026-01-01T00:00:00.000Z",
  });
describe("useMessengerThreadActions", () => {
  it("mutates Messenger only", () => {
    const roleplay = { ...messenger("r"), kind: "roleplay" as const } as unknown as ModeThread;
    const target = messenger();
    const { actions, threads } = capture([target, roleplay]);
    actions.renameMessengerThread("m", "Renamed");
    expect((threads.current[0] as MessengerModeThread).title).toBe("Renamed");
    expect(threads.current[1]).toBe(roleplay);
  });
  it("clears active branch state and preserves inactive messages", () => {
    const target = messenger();
    const inactive = {
      ...target.branches[0],
      id: "inactive",
      createdAt: target.createdAt,
      updatedAt: target.updatedAt,
    };
    const withBranch = {
      ...target,
      branches: [target.branches[0], inactive] as [(typeof target.branches)[0], typeof inactive],
      messages: [],
    };
    const { actions, threads } = capture([withBranch]);
    actions.clearMessengerThreadMessages(target.id);
    expect((threads.current[0] as MessengerModeThread).messages).toEqual([]);
  });
});
