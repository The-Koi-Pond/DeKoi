import { useState, useCallback, useEffect, useRef } from "react";
import {
  NavContext,
  type PondView,
  type NavContextType,
} from "./shared/ui/nav-context";
import type { MessengerThread } from "./engine/messenger";
import {
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  renameMessengerThread as renameMessengerThreadRecord,
} from "./engine/messenger-actions";
import {
  sampleCompanions,
  sampleLorebook,
  samplePersona,
} from "./engine/sample-messenger";
import type { ProviderConnectionId } from "./engine/provider-connection";
import type { SurfaceId } from "./engine/surfaces";
import { MESSENGER } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";
import {
  loadAppSettings,
  normalizeSurfaceStatus,
  saveAppSettings,
  type AppSettings,
  type ShoalSortMode,
} from "./runtime/app-settings";
import {
  loadInitialMessengerThreads,
  loadMessengerThreadsFromStorage,
  saveMessengerThreadsToStorage,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "./runtime/messenger-storage";
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
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>(MESSENGER);
  const [messengerThreads, setMessengerThreads] =
    useState<MessengerThread[]>(loadInitialMessengerThreads);
  const [messengerStorageMode, setMessengerStorageMode] =
    useState<MessengerStorageMode>("local");
  const [messengerStorageStatus, setMessengerStorageStatus] =
    useState<MessengerStorageStatus>("loading");
  const [messengerStorageMessage, setMessengerStorageMessage] =
    useState("Loading Messenger storage.");
  const [remoteRuntimeUrl, setRemoteRuntimeUrlState] =
    useState(readRemoteRuntimeUrl);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [storageReady, setStorageReady] = useState(false);
  const saveRequestId = useRef(0);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  useEffect(() => {
    let cancelled = false;

    loadMessengerThreadsFromStorage(remoteRuntimeUrl).then((snapshot) => {
      if (cancelled) return;
      setMessengerThreads(snapshot.threads);
      setMessengerStorageMode(snapshot.mode);
      setMessengerStorageStatus(snapshot.status);
      setMessengerStorageMessage(snapshot.message);
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

    saveMessengerThreadsToStorage(messengerThreads, remoteRuntimeUrl).then(
      (snapshot) => {
        if (saveRequestId.current !== requestId) return;
        setMessengerStorageMode(snapshot.mode);
        setMessengerStorageStatus(snapshot.status);
        setMessengerStorageMessage(snapshot.message);
      },
    );
  }, [messengerThreads, remoteRuntimeUrl, storageReady]);

  useEffect(() => {
    saveAppSettings(appSettings);
  }, [appSettings]);

  // Esc key closes CareDrawer
  useEffect(() => {
    if (!careOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCareOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [careOpen]);

  const openMessengerThread = useCallback((threadId: string) => {
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId });
  }, []);

  const createMessengerThread = useCallback(() => {
    const now = new Date().toISOString();
    const thread = buildMessengerThread({
      activePersonaId: samplePersona.id,
      characterIds: sampleCompanions.map((companion) => companion.id),
      id: createLocalId("messenger-thread"),
      lorebookIds: [sampleLorebook.id],
      now,
      providerConnectionId: appSettings.activeMessengerConnectionId,
      title: `New Messenger ${messengerThreads.length + 1}`,
    });

    setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId: thread.id });
    return thread;
  }, [appSettings.activeMessengerConnectionId, messengerThreads.length]);

  const updateMessengerThread = useCallback((thread: MessengerThread) => {
    setMessengerThreads((currentThreads) =>
      currentThreads.some((currentThread) => currentThread.id === thread.id)
        ? currentThreads.map((currentThread) =>
            currentThread.id === thread.id ? thread : currentThread,
          )
        : [thread, ...currentThreads],
    );
  }, []);

  const renameMessengerThread = useCallback((threadId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = new Date().toISOString();
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId
          ? renameMessengerThreadRecord(thread, trimmedTitle, now)
          : thread,
      ),
    );
  }, []);

  const clearMessengerThreadMessages = useCallback((threadId: string) => {
    const now = new Date().toISOString();
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? clearMessengerMessages(thread, now) : thread,
      ),
    );
  }, []);

  const deleteMessengerThread = useCallback(
    (threadId: string) => {
      setMessengerThreads((currentThreads) =>
        currentThreads.filter((thread) => thread.id !== threadId),
      );

      if (view.kind === "messenger" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [view],
  );

  const setRemoteRuntimeUrl = useCallback((url: string) => {
    writeRemoteRuntimeUrl(url);
    setStorageReady(false);
    setMessengerStorageStatus("loading");
    setMessengerStorageMessage("Loading Messenger storage.");
    setRemoteRuntimeUrlState(readRemoteRuntimeUrl());
  }, []);

  const setSendOnEnterSurface = useCallback((surface: SurfaceId) => {
    setAppSettings((currentSettings) => ({
      ...currentSettings,
      sendOnEnterSurface: surface,
    }));
  }, []);

  const setConfirmRelease = useCallback((confirmRelease: boolean) => {
    setAppSettings((currentSettings) => ({
      ...currentSettings,
      confirmRelease,
    }));
  }, []);

  const setSurfaceStatus = useCallback((surfaceStatus: string) => {
    setAppSettings((currentSettings) => ({
      ...currentSettings,
      surfaceStatus: normalizeSurfaceStatus(surfaceStatus),
    }));
  }, []);

  const setShoalSortMode = useCallback((shoalSortMode: ShoalSortMode) => {
    setAppSettings((currentSettings) => ({
      ...currentSettings,
      shoalSortMode,
    }));
  }, []);

  const setActiveMessengerConnectionId = useCallback(
    (activeMessengerConnectionId: ProviderConnectionId) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        activeMessengerConnectionId,
      }));
    },
    [],
  );

  const nav: NavContextType = {
    view,
    selectedSurface,
    messengerThreads,
    messengerStorageMode,
    messengerStorageStatus,
    messengerStorageMessage,
    remoteRuntimeUrl,
    appSettings,
    careOpen,
    careTab,
    setView: useCallback((v: PondView) => setView(v), []),
    setSelectedSurface: useCallback(
      (s: SurfaceId) => setSelectedSurface(s),
      [],
    ),
    createMessengerThread,
    updateMessengerThread,
    renameMessengerThread,
    clearMessengerThreadMessages,
    deleteMessengerThread,
    openMessengerThread,
    setRemoteRuntimeUrl,
    setSendOnEnterSurface,
    setConfirmRelease,
    setSurfaceStatus,
    setShoalSortMode,
    setActiveMessengerConnectionId,
    setCareOpen: useCallback((o: boolean) => setCareOpen(o), []),
    setCareTab: useCallback((t: number) => setCareTab(t), []),
  };

  return (
    <NavContext.Provider value={nav}>
      <Shell nav={nav} />
    </NavContext.Provider>
  );
}
