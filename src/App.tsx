import { useState, useCallback, useEffect, useRef } from "react";
import {
  NavContext,
  type PondView,
  type NavContextType,
} from "./shared/ui/nav-context";
import {
  createCharacterRecord,
  deleteCharacterRecord,
  duplicateCharacterRecord,
  updateCharacterRecord,
  type CharacterRecordInput,
} from "./engine/character-actions";
import {
  createLorebookEntryRecord,
  deleteLorebookEntry,
  duplicateLorebookEntryRecord,
  updateLorebookEntryRecord,
  upsertLorebookEntry,
  type LorebookEntryInput,
} from "./engine/lorebook-actions";
import type { MessengerThread } from "./engine/messenger";
import {
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  renameMessengerThread as renameMessengerThreadRecord,
} from "./engine/messenger-actions";
import {
  createPersonaRecord,
  deletePersonaRecord,
  duplicatePersonaRecord,
  updatePersonaRecord,
  type PersonaRecordInput,
} from "./engine/persona-actions";
import type { ProviderConnectionId } from "./engine/provider-connection";
import {
  createProviderConnectionRecord,
  deleteProviderConnectionRecord,
  duplicateProviderConnectionRecord,
  updateProviderConnectionRecord,
  type ProviderConnectionInput,
} from "./engine/provider-connection-actions";
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
  loadCharacterRecords,
  saveCharacterRecords,
} from "./runtime/character-storage";
import {
  loadLorebookRecords,
  saveLorebookRecords,
} from "./runtime/lorebook-storage";
import {
  loadPersonaRecords,
  savePersonaRecords,
} from "./runtime/persona-storage";
import {
  loadProviderConnectionRecords,
  saveProviderConnectionRecords,
} from "./runtime/provider-connection-storage";
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
  const [characters, setCharacters] = useState(loadCharacterRecords);
  const [personas, setPersonas] = useState(loadPersonaRecords);
  const [lorebooks, setLorebooks] = useState(loadLorebookRecords);
  const [providerConnections, setProviderConnections] = useState(
    loadProviderConnectionRecords,
  );
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

  useEffect(() => {
    saveCharacterRecords(characters);
  }, [characters]);

  useEffect(() => {
    savePersonaRecords(personas);
  }, [personas]);

  useEffect(() => {
    saveLorebookRecords(lorebooks);
  }, [lorebooks]);

  useEffect(() => {
    saveProviderConnectionRecords(providerConnections);
  }, [providerConnections]);

  // Esc key closes CareDrawer
  useEffect(() => {
    if (!careOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCareOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [careOpen]);

  const createCharacter = useCallback((input: CharacterRecordInput) => {
    const now = new Date().toISOString();
    const character = createCharacterRecord({
      id: createLocalId("character"),
      input,
      now,
    });
    setCharacters((currentCharacters) => [character, ...currentCharacters]);
    return character;
  }, []);

  const updateCharacter = useCallback(
    (characterId: string, input: CharacterRecordInput) => {
      const now = new Date().toISOString();
      setCharacters((currentCharacters) =>
        currentCharacters.map((character) =>
          character.id === characterId
            ? updateCharacterRecord(character, input, now)
            : character,
        ),
      );
    },
    [],
  );

  const duplicateCharacter = useCallback((characterId: string) => {
    const character = characters.find(
      (currentCharacter) => currentCharacter.id === characterId,
    );
    if (!character) return null;

    const now = new Date().toISOString();
    const duplicatedCharacter = duplicateCharacterRecord(
      character,
      createLocalId("character"),
      now,
    );
    setCharacters((currentCharacters) => [
      duplicatedCharacter,
      ...currentCharacters,
    ]);
    return duplicatedCharacter;
  }, [characters]);

  const deleteCharacter = useCallback((characterId: string) => {
    const now = new Date().toISOString();
    setCharacters((currentCharacters) =>
      deleteCharacterRecord(currentCharacters, characterId),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) => {
        if (!thread.characterIds.includes(characterId)) return thread;

        const characterIds = thread.characterIds.filter((id) => id !== characterId);
        return {
          ...thread,
          characterIds,
          mode: characterIds.length > 1 ? "group" : "direct",
          updatedAt: now,
        };
      }),
    );
  }, []);

  const createPersona = useCallback((input: PersonaRecordInput) => {
    const now = new Date().toISOString();
    const persona = createPersonaRecord({
      id: createLocalId("persona"),
      input,
      now,
    });
    setPersonas((currentPersonas) => [persona, ...currentPersonas]);
    return persona;
  }, []);

  const updatePersona = useCallback(
    (personaId: string, input: PersonaRecordInput) => {
      const now = new Date().toISOString();
      setPersonas((currentPersonas) =>
        currentPersonas.map((persona) =>
          persona.id === personaId
            ? updatePersonaRecord(persona, input, now)
            : persona,
        ),
      );
    },
    [],
  );

  const duplicatePersona = useCallback((personaId: string) => {
    const persona = personas.find((currentPersona) => currentPersona.id === personaId);
    if (!persona) return null;

    const now = new Date().toISOString();
    const duplicatedPersona = duplicatePersonaRecord(
      persona,
      createLocalId("persona"),
      now,
    );
    setPersonas((currentPersonas) => [duplicatedPersona, ...currentPersonas]);
    return duplicatedPersona;
  }, [personas]);

  const deletePersona = useCallback((personaId: string) => {
    const now = new Date().toISOString();
    setPersonas((currentPersonas) =>
      deletePersonaRecord(currentPersonas, personaId),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.activePersonaId === personaId
          ? { ...thread, activePersonaId: null, updatedAt: now }
          : thread,
      ),
    );
  }, []);

  const createLorebookEntry = useCallback(
    (lorebookId: string, input: LorebookEntryInput) => {
      if (!lorebooks.some((lorebook) => lorebook.id === lorebookId)) return null;

      const now = new Date().toISOString();
      const entry = createLorebookEntryRecord({
        id: createLocalId("lore-entry"),
        input,
        now,
      });

      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;
          return upsertLorebookEntry(lorebook, entry, now);
        }),
      );

      return entry;
    },
    [lorebooks],
  );

  const updateLorebookEntry = useCallback(
    (lorebookId: string, entryId: string, input: LorebookEntryInput) => {
      const now = new Date().toISOString();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;

          const entry = lorebook.entries.find(
            (currentEntry) => currentEntry.id === entryId,
          );
          if (!entry) return lorebook;

          return upsertLorebookEntry(
            lorebook,
            updateLorebookEntryRecord(entry, input, now),
            now,
          );
        }),
      );
    },
    [],
  );

  const duplicateLorebookEntry = useCallback(
    (lorebookId: string, entryId: string) => {
      const lorebook = lorebooks.find(
        (currentLorebook) => currentLorebook.id === lorebookId,
      );
      const entry = lorebook?.entries.find(
        (currentEntry) => currentEntry.id === entryId,
      );
      if (!entry) return null;

      const now = new Date().toISOString();
      const duplicatedEntry = duplicateLorebookEntryRecord(
        entry,
        createLocalId("lore-entry"),
        now,
      );

      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) => {
          if (lorebook.id !== lorebookId) return lorebook;
          return upsertLorebookEntry(lorebook, duplicatedEntry, now);
        }),
      );

      return duplicatedEntry;
    },
    [lorebooks],
  );

  const removeLorebookEntry = useCallback(
    (lorebookId: string, entryId: string) => {
      const now = new Date().toISOString();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) =>
          lorebook.id === lorebookId
            ? deleteLorebookEntry(lorebook, entryId, now)
            : lorebook,
        ),
      );
    },
    [],
  );

  const createProviderConnection = useCallback(
    (input: ProviderConnectionInput) => {
      const now = new Date().toISOString();
      const connection = createProviderConnectionRecord({
        id: createLocalId("connection"),
        input,
        now,
      });
      setProviderConnections((currentConnections) => [
        connection,
        ...currentConnections,
      ]);
      return connection;
    },
    [],
  );

  const updateProviderConnection = useCallback(
    (connectionId: string, input: ProviderConnectionInput) => {
      const now = new Date().toISOString();
      setProviderConnections((currentConnections) =>
        currentConnections.map((connection) =>
          connection.id === connectionId
            ? updateProviderConnectionRecord(connection, input, now)
            : connection,
        ),
      );
    },
    [],
  );

  const duplicateProviderConnection = useCallback((connectionId: string) => {
    const connection = providerConnections.find(
      (currentConnection) => currentConnection.id === connectionId,
    );
    if (!connection) return null;

    const now = new Date().toISOString();
    const duplicatedConnection = duplicateProviderConnectionRecord(
      connection,
      createLocalId("connection"),
      now,
    );
    setProviderConnections((currentConnections) => [
      duplicatedConnection,
      ...currentConnections,
    ]);
    return duplicatedConnection;
  }, [providerConnections]);

  const deleteProviderConnection = useCallback((connectionId: string) => {
    if (providerConnections.length <= 1) return;

    const nextConnections = deleteProviderConnectionRecord(
      providerConnections,
      connectionId,
    );
    if (nextConnections.length === providerConnections.length) return;

    const fallbackConnection = nextConnections[0];
    const now = new Date().toISOString();
    setProviderConnections(nextConnections);
    setAppSettings((currentSettings) =>
      currentSettings.activeMessengerConnectionId === connectionId
        ? {
            ...currentSettings,
            activeMessengerConnectionId: fallbackConnection.id,
          }
        : currentSettings,
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.providerConnectionId === connectionId
          ? {
              ...thread,
              providerConnectionId: fallbackConnection.id,
              updatedAt: now,
            }
          : thread,
      ),
    );
  }, [providerConnections]);

  const openMessengerThread = useCallback((threadId: string) => {
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId });
  }, []);

  const createMessengerThread = useCallback(() => {
    const now = new Date().toISOString();
    const activePersona = personas[0] ?? null;
    const activeConnection =
      providerConnections.find(
        (connection) => connection.id === appSettings.activeMessengerConnectionId,
      ) ??
      providerConnections[0] ??
      null;
    const thread = buildMessengerThread({
      activePersonaId: activePersona?.id ?? null,
      characterIds: characters.map((companion) => companion.id),
      id: createLocalId("messenger-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Messenger ${messengerThreads.length + 1}`,
    });

    setMessengerThreads((currentThreads) => [thread, ...currentThreads]);
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId: thread.id });
    return thread;
  }, [
    appSettings.activeMessengerConnectionId,
    characters,
    lorebooks,
    messengerThreads.length,
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
    characters,
    personas,
    lorebooks,
    providerConnections,
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
    deleteLorebookEntry: removeLorebookEntry,
    createProviderConnection,
    updateProviderConnection,
    duplicateProviderConnection,
    deleteProviderConnection,
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
