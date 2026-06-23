import { useState, useCallback, useEffect } from "react";
import {
  NavContext,
  type PondView,
  type NavContextType,
} from "./shared/ui/nav-context";
import type { SurfaceId } from "./engine/surfaces";
import { BUBBLES } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";

export default function App() {
  const [view, setView] = useState<PondView>({ kind: "pond" });
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>(BUBBLES);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  // Esc key closes CareDrawer
  useEffect(() => {
    if (!careOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCareOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [careOpen]);

  const nav: NavContextType = {
    view,
    selectedSurface,
    careOpen,
    careTab,
    setView: useCallback((v: PondView) => setView(v), []),
    setSelectedSurface: useCallback(
      (s: SurfaceId) => setSelectedSurface(s),
      [],
    ),
    setCareOpen: useCallback((o: boolean) => setCareOpen(o), []),
    setCareTab: useCallback((t: number) => setCareTab(t), []),
  };

  return (
    <NavContext.Provider value={nav}>
      <Shell nav={nav} />
    </NavContext.Provider>
  );
}
