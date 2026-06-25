import { useState, useCallback } from "react";
import {
  NavContext,
  type PondView,
  type SideRailView,
  type NavContextType,
} from "./features/navigation/nav-context";
import { useCharacterActions } from "./features/navigation/use-character-actions";
import { useLorebookActions } from "./features/navigation/use-lorebook-actions";
import { usePersonaActions } from "./features/navigation/use-persona-actions";
import { useProviderConnectionActions } from "./features/navigation/use-provider-connection-actions";
import { useAppImportExportActions } from "./features/navigation/use-app-import-export-actions";
import { useAppSettingsActions } from "./features/navigation/use-app-settings-actions";
import { useAppStorageSync } from "./features/navigation/use-app-storage-sync";
import { useViewActions } from "./features/navigation/use-view-actions";
import { currentIsoTimestamp } from "./shared/browser/current-time";
import { createRecordId } from "./shared/browser/record-id";
import { useEscapeKey } from "./shared/ui/use-escape-key";
import type { ClassicThread } from "./engine/classic";
import {
  clearClassicEntries,
  createClassicThread as buildClassicThread,
  deleteClassicThread as deleteClassicThreadRecord,
  renameClassicThread as renameClassicThreadRecord,
} from "./engine/classic-actions";
import type { MessengerThread } from "./engine/messenger";
import {
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  deleteMessengerThread as deleteMessengerThreadRecord,
  renameMessengerThread as renameMessengerThreadRecord,
} from "./engine/messenger-actions";
import type { RippleState, RippleStateOwnerKind } from "./engine/ripples";
import {
  createRippleRecord,
  createRippleState,
  deleteRippleStateForOwner,
  updateRippleRecord,
  type RippleInput,
} from "./engine/ripple-actions";
import type { SurfaceId } from "./engine/surfaces";
import { MESSENGER } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";
import { loadAppSettings, type AppSettings } from "./runtime/app-settings";
import {
  loadInitialMessengerThreads,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "./runtime/messenger-storage";
import { loadCharacterRecords } from "./runtime/character-storage";
import { loadClassicThreads } from "./runtime/classic-storage";
import { loadLorebookRecords } from "./runtime/lorebook-storage";
import { loadPersonaRecords } from "./runtime/persona-storage";
import { loadProviderConnectionRecords } from "./runtime/provider-connection-storage";
import { loadRippleStates } from "./runtime/ripple-state-storage";
import { readRemoteRuntimeUrl } from "./runtime/runtime-target";

export default function App() {
  const [view, setView] = useState<PondView>({ kind: "pond" });
  const [sideRailView, setSideRailView] = useState<SideRailView>("shoal");
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId>(MESSENGER);
  const [characters, setCharacters] = useState(loadCharacterRecords);
  const [personas, setPersonas] = useState(loadPersonaRecords);
  const [lorebooks, setLorebooks] = useState(loadLorebookRecords);
  const [providerConnections, setProviderConnections] = useState(
    loadProviderConnectionRecords,
  );
  const [classicThreads, setClassicThreads] =
    useState<ClassicThread[]>(loadClassicThreads);
  const [messengerThreads, setMessengerThreads] = useState<MessengerThread[]>(
    loadInitialMessengerThreads,
  );
  const [rippleStates, setRippleStates] =
    useState<RippleState[]>(loadRippleStates);
  const [messengerStorageMode, setMessengerStorageMode] =
    useState<MessengerStorageMode>("unavailable");
  const [messengerStorageStatus, setMessengerStorageStatus] =
    useState<MessengerStorageStatus>("loading");
  const [messengerStorageMessage, setMessengerStorageMessage] = useState(
    "Loading Messenger storage.",
  );
  const [remoteRuntimeUrl, setRemoteRuntimeUrlState] =
    useState(readRemoteRuntimeUrl);
  const [appSettings, setAppSettings] = useState<AppSettings>(loadAppSettings);
  const [storageReady, setStorageReady] = useState(false);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  const {
    setView: setNavView,
    setSideRailView: setNavSideRailView,
    setSelectedSurface: setNavSelectedSurface,
    openClassicThread,
    openMessengerThread,
  } = useViewActions({
    setView,
    setSideRailView,
    setSelectedSurface,
  });

  useAppStorageSync({
    appSettings,
    characters,
    personas,
    lorebooks,
    providerConnections,
    classicThreads,
    messengerThreads,
    rippleStates,
    remoteRuntimeUrl,
    setAppSettings,
    setCharacters,
    setPersonas,
    setLorebooks,
    setProviderConnections,
    setClassicThreads,
    setMessengerThreads,
    setRippleStates,
    setMessengerStorageMode,
    setMessengerStorageStatus,
    setMessengerStorageMessage,
    setStorageReady,
    storageReady,
  });

  const {
    setRemoteRuntimeUrl,
    setSendOnEnterSurface,
    setConfirmRelease,
    setSurfaceStatus,
    setShoalSortMode,
    setActiveMessengerConnectionId,
    updateAppSettings,
  } = useAppSettingsActions({
    setAppSettings,
    setRemoteRuntimeUrlState,
    setStorageReady,
    setMessengerStorageStatus,
    setMessengerStorageMessage,
  });

  const {
    createStorageBundle,
    importStorageBundle,
    importLegacyData,
  } = useAppImportExportActions({
    appSettings,
    characters,
    personas,
    lorebooks,
    providerConnections,
    classicThreads,
    messengerThreads,
    rippleStates,
    setAppSettings,
    setCharacters,
    setPersonas,
    setLorebooks,
    setProviderConnections,
    setClassicThreads,
    setMessengerThreads,
    setRippleStates,
    setMessengerStorageStatus,
    setMessengerStorageMessage,
    setSelectedSurface,
    setView: setNavView,
  });

  const closeCareDrawer = useCallback(() => setCareOpen(false), []);
  useEscapeKey(careOpen, closeCareDrawer);

  const {
    createCharacter,
    updateCharacter,
    duplicateCharacter,
    deleteCharacter,
  } = useCharacterActions({
    characters,
    setCharacters,
    setClassicThreads,
    setMessengerThreads,
  });

  const {
    createPersona,
    updatePersona,
    duplicatePersona,
    deletePersona,
  } = usePersonaActions({
    personas,
    setPersonas,
    setClassicThreads,
    setMessengerThreads,
  });

  const {
    createLorebookEntry,
    updateLorebookEntry,
    duplicateLorebookEntry,
    deleteLorebookEntry,
    createLorebook,
    updateLorebook,
    deleteLorebook,
  } = useLorebookActions({
    lorebooks,
    setLorebooks,
    setCharacters,
    setClassicThreads,
    setMessengerThreads,
  });

  const {
    createProviderConnection,
    updateProviderConnection,
    duplicateProviderConnection,
    deleteProviderConnection,
  } = useProviderConnectionActions({
    providerConnections,
    setProviderConnections,
    setAppSettings,
    setClassicThreads,
    setMessengerThreads,
  });

  const createClassicThread = useCallback(() => {
    const now = currentIsoTimestamp();
    const activePersona = personas[0] ?? null;
    const activeConnection =
      providerConnections.find(
        (connection) =>
          connection.id === appSettings.activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildClassicThread({
      activePersonaId: activePersona?.id ?? null,
      characterIds: characters.slice(0, 1).map((companion) => companion.id),
      id: createRecordId("classic-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Classic ${classicThreads.length + 1}`,
    });

    setClassicThreads((currentThreads) => [thread, ...currentThreads]);
    openClassicThread(thread.id);
    return thread;
  }, [
    appSettings.activeMessengerConnectionId,
    characters,
    classicThreads.length,
    lorebooks,
    openClassicThread,
    personas,
    providerConnections,
  ]);

  const updateClassicThread = useCallback((thread: ClassicThread) => {
    setClassicThreads((currentThreads) =>
      currentThreads.some((currentThread) => currentThread.id === thread.id)
        ? currentThreads.map((currentThread) =>
            currentThread.id === thread.id ? thread : currentThread,
          )
        : [thread, ...currentThreads],
    );
  }, []);

  const renameClassicThread = useCallback((threadId: string, title: string) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const now = currentIsoTimestamp();
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId
          ? renameClassicThreadRecord(thread, trimmedTitle, now)
          : thread,
      ),
    );
  }, []);

  const clearClassicThreadEntries = useCallback((threadId: string) => {
    const now = currentIsoTimestamp();
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? clearClassicEntries(thread, now) : thread,
      ),
    );
  }, []);

  const deleteClassicThread = useCallback(
    (threadId: string) => {
      setClassicThreads((currentThreads) =>
        deleteClassicThreadRecord(currentThreads, threadId),
      );
      setRippleStates((currentStates) =>
        deleteRippleStateForOwner(currentStates, "classic-thread", threadId),
      );

      if (view.kind === "classic" && view.threadId === threadId) {
        setNavView({ kind: "pond" });
      }
    },
    [setNavView, view],
  );

  const createMessengerThread = useCallback(() => {
    const now = currentIsoTimestamp();
    const activePersona = personas[0] ?? null;
    const activeConnection =
      providerConnections.find(
        (connection) =>
          connection.id === appSettings.activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildMessengerThread({
      activePersonaId: activePersona?.id ?? null,
      characterIds: characters.map((companion) => companion.id),
      id: createRecordId("messenger-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Messenger ${messengerThreads.length + 1}`,
    });

    setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
    openMessengerThread(thread.id);
    return thread;
  }, [
    appSettings.activeMessengerConnectionId,
    characters,
    lorebooks,
    messengerThreads.length,
    openMessengerThread,
    personas,
    providerConnections,
  ]);

  const updateMessengerThread = useCallback((thread: MessengerThread) => {
    setMessengerThreads((currentThreads) =>
      currentThreads.some((currentThread) => currentThread.id === thread.id)
        ? currentThreads.map((currentThread) =>
            currentThread.id === thread.id ? thread : currentThread,
          )
        : [thread, ...currentThreads],
    );
  }, []);

  const renameMessengerThread = useCallback(
    (threadId: string, title: string) => {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) return;

      const now = currentIsoTimestamp();
      setMessengerThreads((currentThreads) =>
        currentThreads.map((thread) =>
          thread.id === threadId
            ? renameMessengerThreadRecord(thread, trimmedTitle, now)
            : thread,
        ),
      );
    },
    [],
  );

  const clearMessengerThreadMessages = useCallback((threadId: string) => {
    const now = currentIsoTimestamp();
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId ? clearMessengerMessages(thread, now) : thread,
      ),
    );
  }, []);

  const deleteMessengerThread = useCallback(
    (threadId: string) => {
      setMessengerThreads((currentThreads) =>
        deleteMessengerThreadRecord(currentThreads, threadId),
      );
      setRippleStates((currentStates) =>
        deleteRippleStateForOwner(currentStates, "messenger-thread", threadId),
      );

      if (view.kind === "messenger" && view.threadId === threadId) {
        setNavView({ kind: "pond" });
      }
    },
    [setNavView, view],
  );

  const getRippleState = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string) =>
      rippleStates.find(
        (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
      ) ?? null,
    [rippleStates],
  );

  const createRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, input: RippleInput) => {
      const now = currentIsoTimestamp();
      const ripple = createRippleRecord({
        id: createRecordId("ripple"),
        input,
        now,
      });

      setRippleStates((currentStates) => {
        const existingState = currentStates.find(
          (state) => state.ownerKind === ownerKind && state.ownerId === ownerId,
        );

        if (!existingState) {
          return [
            createRippleState({
              id: createRecordId("ripple-state"),
              now,
              ownerId,
              ownerKind,
              ripples: [ripple],
            }),
            ...currentStates,
          ];
        }

        return currentStates.map((state) =>
          state.id === existingState.id
            ? {
                ...state,
                ripples: [ripple, ...state.ripples],
                updatedAt: now,
              }
            : state,
        );
      });

      return ripple;
    },
    [],
  );

  const updateRipple = useCallback(
    (
      ownerKind: RippleStateOwnerKind,
      ownerId: string,
      rippleId: string,
      input: RippleInput,
    ) => {
      const now = currentIsoTimestamp();
      setRippleStates((currentStates) =>
        currentStates.map((state) =>
          state.ownerKind === ownerKind && state.ownerId === ownerId
            ? {
                ...state,
                ripples: state.ripples.map((ripple) =>
                  ripple.id === rippleId
                    ? updateRippleRecord(ripple, input, now)
                    : ripple,
                ),
                updatedAt: now,
              }
            : state,
        ),
      );
    },
    [],
  );

  const deleteRipple = useCallback(
    (ownerKind: RippleStateOwnerKind, ownerId: string, rippleId: string) => {
      const now = currentIsoTimestamp();
      setRippleStates((currentStates) =>
        currentStates.flatMap((state) => {
          if (state.ownerKind !== ownerKind || state.ownerId !== ownerId) {
            return [state];
          }

          const ripples = state.ripples.filter(
            (ripple) => ripple.id !== rippleId,
          );
          return ripples.length > 0
            ? [{ ...state, ripples, updatedAt: now }]
            : [];
        }),
      );
    },
    [],
  );

  const nav: NavContextType = {
    view,
    sideRailView,
    selectedSurface,
    characters,
    personas,
    lorebooks,
    providerConnections,
    classicThreads,
    messengerThreads,
    messengerStorageMode,
    messengerStorageStatus,
    messengerStorageMessage,
    rippleStates,
    remoteRuntimeUrl,
    appSettings,
    careOpen,
    careTab,
    setView: setNavView,
    setSideRailView: setNavSideRailView,
    setSelectedSurface: setNavSelectedSurface,
    createCharacter,
    updateCharacter,
    duplicateCharacter,
    deleteCharacter,
    createPersona,
    updatePersona,
    duplicatePersona,
    deletePersona,
    createLorebookEntry,
    updateLorebookEntry,
    duplicateLorebookEntry,
    deleteLorebookEntry,
    createLorebook,
    updateLorebook,
    deleteLorebook,
    createProviderConnection,
    updateProviderConnection,
    duplicateProviderConnection,
    deleteProviderConnection,
    createClassicThread,
    updateClassicThread,
    renameClassicThread,
    clearClassicThreadEntries,
    deleteClassicThread,
    openClassicThread,
    createMessengerThread,
    updateMessengerThread,
    renameMessengerThread,
    clearMessengerThreadMessages,
    deleteMessengerThread,
    openMessengerThread,
    getRippleState,
    createRipple,
    updateRipple,
    deleteRipple,
    createStorageBundle,
    importStorageBundle,
    importLegacyData,
    setRemoteRuntimeUrl,
    updateAppSettings,
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
