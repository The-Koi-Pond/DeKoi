import { useCallback } from "react";
import { CLASSIC, MESSENGER, type SurfaceId } from "../../engine/surfaces";
import type { PondView, SideRailView } from "./nav-types";
import type { StateSetter } from "./state-setter";

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

  const openClassicThread = useCallback(
    (threadId: string) => {
      setSideRailView("shoal");
      setSelectedSurface(CLASSIC);
      setView({ kind: "classic", threadId });
    },
    [setSelectedSurface, setSideRailView, setView],
  );

  const openMessengerThread = useCallback(
    (threadId: string) => {
      setSideRailView("shoal");
      setSelectedSurface(MESSENGER);
      setView({ kind: "messenger", threadId });
    },
    [setSelectedSurface, setSideRailView, setView],
  );

  return {
    setView: setNavView,
    setSideRailView: setNavSideRailView,
    setSelectedSurface: setNavSelectedSurface,
    openClassicThread,
    openMessengerThread,
  };
}
