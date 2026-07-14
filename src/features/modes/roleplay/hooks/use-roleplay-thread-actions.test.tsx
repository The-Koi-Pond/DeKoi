import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ModeThread,
  RoleplayModeThread,
} from "../../../../engine/contracts/types/mode-thread";
import { createRoleplayThread } from "../../../../engine/modes/roleplay/roleplay-actions";
import type { LoreRuntimeState } from "../../../../engine/contracts/types/lore-runtime-state";
import type { MacroVariableScope } from "../../../../engine/contracts/types/macro-variables";
import type { RippleState } from "../../../../engine/contracts/types/ripples";
import { useRoleplayThreadActions } from "./use-roleplay-thread-actions";
const roleplay = (id = "r") =>
  createRoleplayThread({
    id,
    branchId: `${id}-branch`,
    title: id,
    characterIds: [],
    activePersonaId: null,
    systemPrompt: "System",
    openingCharacter: null,
    now: "2026-01-01T00:00:00.000Z",
  });
function capture(modeThreads: ModeThread[]) {
  const threads = { current: modeThreads },
    lore = { current: [] as LoreRuntimeState[] },
    macro = { current: [] as MacroVariableScope[] },
    ripple = { current: [] as RippleState[] };
  const captured: { value: ReturnType<typeof useRoleplayThreadActions> | null } = { value: null };
  function Capture() {
    captured.value = useRoleplayThreadActions({
      activeMessengerConnectionId: "c",
      characters: [],
      modeThreads: threads.current,
      personas: [],
      providerConnections: [],
      setModeThreads: (next) => {
        threads.current = typeof next === "function" ? next(threads.current) : next;
      },
      setLoreRuntimeStates: (next) => {
        lore.current = typeof next === "function" ? next(lore.current) : next;
      },
      setMacroVariableStates: (next) => {
        macro.current = typeof next === "function" ? next(macro.current) : next;
      },
      setRippleStates: (next) => {
        ripple.current = typeof next === "function" ? next(ripple.current) : next;
      },
      setView: () => {},
      view: { kind: "pond" },
      promptPresets: [],
      openChatSettings: () => {},
      openRoleplayThread: () => {},
    });
    return null;
  }
  renderToStaticMarkup(<Capture />);
  const actions = captured.value;
  if (!actions) throw new Error("not captured");
  return { actions, threads };
}
describe("useRoleplayThreadActions", () => {
  it("mutates Roleplay only", () => {
    const target = roleplay();
    const messenger = { ...target, kind: "messenger" as const } as unknown as ModeThread;
    const { actions, threads } = capture([target, messenger]);
    actions.renameRoleplayThread(target.id, "Renamed");
    expect((threads.current[0] as RoleplayModeThread).title).toBe("Renamed");
    expect(threads.current[1]).toBe(messenger);
  });
  it("creates opening greeting with required IDs", () => {
    const { actions } = capture([]);
    const thread = actions.createRoleplayThread();
    expect(thread.kind).toBe("roleplay");
    expect(thread.activeBranchId).toBe(thread.branches[0].id);
  });
});
