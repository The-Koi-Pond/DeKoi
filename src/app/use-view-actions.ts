import { useCallback } from "react";
import type { NavViewState, PondView, SideRailView } from "../features/navigation";
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
  const setNavView = useCallback(
    (view: PondView) => {
      setView(view);
    },
    [setView],
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
      setSideRailView("shoal");
      setSelectedSurface(ROLEPLAY_SURFACE);
      setView({ kind: "roleplay", threadId });
    },
    [setSelectedSurface, setSideRailView, setView],
  );

  const openMessengerThread = useCallback(
    (threadId: string) => {
      setSideRailView("shoal");
      setSelectedSurface(MESSENGER_SURFACE);
      setView({ kind: "messenger", threadId });
    },
    [setSelectedSurface, setSideRailView, setView],
  );

  return {
    setView: setNavView,
    setSideRailView: setNavSideRailView,
    setSelectedSurface: setNavSelectedSurface,
    openRoleplayThread,
    openMessengerThread,
  };
}
