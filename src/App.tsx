import { useState, useCallback, useEffect, useRef } from "react";
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
  loadBubbleThreadsFromStorage,
  loadInitialBubbleThreads,
  saveBubbleThreadsToStorage,
  type BubbleStorageMode,
  type BubbleStorageStatus,
} from "./runtime/bubble-storage";
import {
  readRemoteRuntimeUrl,
  writeRemoteRuntimeUrl,
} from "./runtime/remote-runtime";

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
    useState<BubbleThread[]>(loadInitialBubbleThreads);
  const [bubbleStorageMode, setBubbleStorageMode] =
    useState<BubbleStorageMode>("local");
  const [bubbleStorageStatus, setBubbleStorageStatus] =
    useState<BubbleStorageStatus>("loading");
  const [bubbleStorageMessage, setBubbleStorageMessage] =
    useState("Loading Bubble storage.");
  const [remoteRuntimeUrl, setRemoteRuntimeUrlState] =
    useState(readRemoteRuntimeUrl);
  const [storageReady, setStorageReady] = useState(false);
  const saveRequestId = useRef(0);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadBubbleThreadsFromStorage(remoteRuntimeUrl).then((snapshot) => {
      if (cancelled) return;
      setBubbleThreads(snapshot.threads);
      setBubbleStorageMode(snapshot.mode);
      setBubbleStorageStatus(snapshot.status);
      setBubbleStorageMessage(snapshot.message);
      setStorageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [remoteRuntimeUrl]);

  useEffect(() => {
    if (!storageReady) return;

    const requestId = saveRequestId.current + 1;
    saveRequestId.current = requestId;

    saveBubbleThreadsToStorage(bubbleThreads, remoteRuntimeUrl).then(
      (snapshot) => {
        if (saveRequestId.current !== requestId) return;
        setBubbleStorageMode(snapshot.mode);
        setBubbleStorageStatus(snapshot.status);
        setBubbleStorageMessage(snapshot.message);
      },
    );
  }, [bubbleThreads, remoteRuntimeUrl, storageReady]);

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

  const setRemoteRuntimeUrl = useCallback((url: string) => {
    writeRemoteRuntimeUrl(url);
    setStorageReady(false);
    setBubbleStorageStatus("loading");
    setBubbleStorageMessage("Loading Bubble storage.");
    setRemoteRuntimeUrlState(readRemoteRuntimeUrl());
  }, []);

  const nav: NavContextType = {
    view,
    selectedSurface,
    bubbleThreads,
    bubbleStorageMode,
    bubbleStorageStatus,
    bubbleStorageMessage,
    remoteRuntimeUrl,
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
    setRemoteRuntimeUrl,
    setCareOpen: useCallback((o: boolean) => setCareOpen(o), []),
    setCareTab: useCallback((t: number) => setCareTab(t), []),
  };

  return (
    <NavContext.Provider value={nav}>
      <Shell nav={nav} />
    </NavContext.Provider>
  );
}
