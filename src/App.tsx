import { useState, useCallback, useEffect } from "react";
import {
  NavContext,
  type PondView,
  type NavContextType,
} from "./shared/ui/nav-context";
import type { BubbleThread } from "./engine/bubbles";
import {
  clearBubbleMessages,
  createBubbleThread as buildBubbleThread,
  renameBubbleThread as renameBubbleThreadRecord,
} from "./engine/bubble-actions";
import {
  sampleCompanions,
  sampleLorebook,
  samplePersona,
} from "./engine/sample-bubbles";
import type { SurfaceId } from "./engine/surfaces";
import { BUBBLES } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";
import {
  loadBubbleThreads,
  saveBubbleThreads,
} from "./runtime/bubble-local-storage";

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  const [view, setView] = useState<PondView>({ kind: "pond" });
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>(BUBBLES);
  const [bubbleThreads, setBubbleThreads] =
    useState<BubbleThread[]>(loadBubbleThreads);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  useEffect(() => {
    saveBubbleThreads(bubbleThreads);
  }, [bubbleThreads]);

  // Esc key closes CareDrawer
  useEffect(() => {
    if (!careOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCareOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [careOpen]);

  const openBubbleThread = useCallback((threadId: string) => {
    setSelectedSurface(BUBBLES);
    setView({ kind: "bubble", threadId });
  }, []);

  const createBubbleThread = useCallback(() => {
    const now = new Date().toISOString();
    const thread = buildBubbleThread({
      activePersonaId: samplePersona.id,
      characterIds: sampleCompanions.map((companion) => companion.id),
      id: createLocalId("bubble-thread"),
      lorebookIds: [sampleLorebook.id],
      now,
      title: `New Bubble ${bubbleThreads.length + 1}`,
    });

    setBubbleThreads((currentThreads) => [thread, ...currentThreads]);
    setSelectedSurface(BUBBLES);
    setView({ kind: "bubble", threadId: thread.id });
    return thread;
  }, [bubbleThreads.length]);

  const updateBubbleThread = useCallback((thread: BubbleThread) => {
    setBubbleThreads((currentThreads) =>
      currentThreads.some((currentThread) => currentThread.id === thread.id)
        ? currentThreads.map((currentThread) =>
            currentThread.id === thread.id ? thread : currentThread,
          )
        : [thread, ...currentThreads],
    );
  }, []);

  const renameBubbleThread = useCallback((threadId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = new Date().toISOString();
    setBubbleThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId
          ? renameBubbleThreadRecord(thread, trimmedTitle, now)
          : thread,
      ),
    );
  }, []);

  const clearBubbleThreadMessages = useCallback((threadId: string) => {
    const now = new Date().toISOString();
    setBubbleThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? clearBubbleMessages(thread, now) : thread,
      ),
    );
  }, []);

  const deleteBubbleThread = useCallback(
    (threadId: string) => {
      setBubbleThreads((currentThreads) =>
        currentThreads.filter((thread) => thread.id !== threadId),
      );

      if (view.kind === "bubble" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [view],
  );

  const nav: NavContextType = {
    view,
    selectedSurface,
    bubbleThreads,
    careOpen,
    careTab,
    setView: useCallback((v: PondView) => setView(v), []),
    setSelectedSurface: useCallback(
      (s: SurfaceId) => setSelectedSurface(s),
      [],
    ),
    createBubbleThread,
    updateBubbleThread,
    renameBubbleThread,
    clearBubbleThreadMessages,
    deleteBubbleThread,
    openBubbleThread,
    setCareOpen: useCallback((o: boolean) => setCareOpen(o), []),
    setCareTab: useCallback((t: number) => setCareTab(t), []),
  };

  return (
    <NavContext.Provider value={nav}>
      <Shell nav={nav} />
    </NavContext.Provider>
  );
}
