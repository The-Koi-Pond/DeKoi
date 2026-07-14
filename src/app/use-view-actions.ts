import { useCallback, useEffect, useRef } from "react";
import { listenDesktopWindowCloseRequest } from "../shared/api/window-controls";
import type { NavViewState, PondView, SideRailView, ViewLeavePolicy } from "../features/navigation";
import type { StateSetter } from "../shared/react/state-setter";

type SurfaceId = NavViewState["selectedSurface"];

const ROLEPLAY_SURFACE: SurfaceId = "roleplay";
const MESSENGER_SURFACE: SurfaceId = "messenger";

type UseViewActionsInput = {
  setView: StateSetter<PondView>;
  setSideRailView: StateSetter<SideRailView>;
  setSelectedSurface: StateSetter<SurfaceId>;
};

export function useViewActions({
  setView,
  setSideRailView,
  setSelectedSurface,
}: UseViewActionsInput) {
  const leaveGuardRef = useRef<(() => ViewLeavePolicy) | null>(null);
  const registerViewLeaveGuard = useCallback((guard: (() => ViewLeavePolicy) | null) => {
    leaveGuardRef.current = guard;
    return () => {
      if (leaveGuardRef.current === guard) leaveGuardRef.current = null;
    };
  }, []);

  const requestLeaveCurrentView = useCallback(() => {
    const guard = leaveGuardRef.current;
    if (!guard) return true;
    const policy = guard();
    if (policy === "deny-silently") return false;
    if (policy === "confirm-discard" && !window.confirm("Discard unsaved changes?")) return false;
    leaveGuardRef.current = null;
    return true;
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      // Browser beforeunload can only block with a confirmation prompt, so arm it for every non-clean policy.
      if (leaveGuardRef.current?.() === "clean" || !leaveGuardRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    const unlistenPromise = listenDesktopWindowCloseRequest(() => requestLeaveCurrentView());
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void unlistenPromise.then((unlisten) => unlisten?.());
    };
  }, [requestLeaveCurrentView]);

  const setNavView = useCallback(
    (view: PondView) => {
      if (!requestLeaveCurrentView()) return;
      setView(view);
    },
    [requestLeaveCurrentView, setView],
  );

  const setNavSideRailView = useCallback(
    (view: SideRailView) => {
      setSideRailView(view);
    },
    [setSideRailView],
  );

  const setNavSelectedSurface = useCallback(
    (surface: SurfaceId) => {
      setSideRailView("shoal");
      setSelectedSurface(surface);
    },
    [setSelectedSurface, setSideRailView],
  );

  const openRoleplayThread = useCallback(
    (threadId: string) => {
      if (!requestLeaveCurrentView()) return;
      setSideRailView("shoal");
      setSelectedSurface(ROLEPLAY_SURFACE);
      setView({ kind: "roleplay", threadId });
    },
    [requestLeaveCurrentView, setSelectedSurface, setSideRailView, setView],
  );

  const openMessengerThread = useCallback(
    (threadId: string) => {
      if (!requestLeaveCurrentView()) return;
      setSideRailView("shoal");
      setSelectedSurface(MESSENGER_SURFACE);
      setView({ kind: "messenger", threadId });
    },
    [requestLeaveCurrentView, setSelectedSurface, setSideRailView, setView],
  );

  return {
    setView: setNavView,
    registerViewLeaveGuard,
    requestLeaveCurrentView,
    setSideRailView: setNavSideRailView,
    setSelectedSurface: setNavSelectedSurface,
    openRoleplayThread,
    openMessengerThread,
  };
}
