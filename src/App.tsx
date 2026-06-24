import { useState, useCallback, useEffect, useRef } from "react";

// requestIdleCallback isn't in every TS DOM lib and isn't available everywhere,
// so fall back to setTimeout. Only used to coalesce storage writes.
type IdleHandle = number;
const requestIdle: (cb: () => void) => IdleHandle =
  typeof window !== "undefined" &&
  typeof (window as unknown as { requestIdleCallback?: unknown })
    .requestIdleCallback === "function"
    ? (cb) =>
        (
          window as unknown as {
            requestIdleCallback: (cb: () => void) => number;
          }
        ).requestIdleCallback(cb)
    : (cb) => window.setTimeout(cb, 1) as unknown as IdleHandle;
const cancelIdle: (handle: IdleHandle) => void =
  typeof window !== "undefined" &&
  typeof (window as unknown as { cancelIdleCallback?: unknown })
    .cancelIdleCallback === "function"
    ? (handle) =>
        (
          window as unknown as {
            cancelIdleCallback: (handle: number) => void;
          }
        ).cancelIdleCallback(handle)
    : (handle) => window.clearTimeout(handle);
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
import type { ClassicThread } from "./engine/classic";
import {
  clearClassicEntries,
  createClassicThread as buildClassicThread,
  deleteClassicThread as deleteClassicThreadRecord,
  renameClassicThread as renameClassicThreadRecord,
} from "./engine/classic-actions";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
  deleteLorebookEntry,
  duplicateLorebookEntryRecord,
  updateLorebookEntryRecord,
  updateLorebookRecord,
  upsertLorebookEntry,
  type LorebookEntryInput,
  type LorebookInput,
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
import type { RippleState, RippleStateOwnerKind } from "./engine/ripples";
import {
  createRippleRecord,
  createRippleState,
  updateRippleRecord,
  type RippleInput,
} from "./engine/ripple-actions";
import type { SurfaceId } from "./engine/surfaces";
import { CLASSIC, MESSENGER } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";
import {
  loadAppSettings,
  normalizeSurfaceStatus,
  loadAppSettingsFromStorage,
  saveAppSettingsToStorage,
  type AppSettings,
  type ShoalSortMode,
} from "./runtime/app-settings";
import {
  createDeKoiStorageBundle,
  type DeKoiStorageBundle,
} from "./runtime/dekoi-storage-bundle";
import type { DeKoiLegacyImportData } from "./runtime/legacy-import";
import {
  loadInitialMessengerThreads,
  loadMessengerThreadsFromStorage,
  saveMessengerThreadsToStorage,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "./runtime/messenger-storage";
import {
  loadCharacterRecords,
  loadCharacterRecordsFromStorage,
  saveCharacterRecordsToStorage,
} from "./runtime/character-storage";
import {
  loadClassicThreads,
  loadClassicThreadsFromStorage,
  saveClassicThreadsToStorage,
} from "./runtime/classic-storage";
import {
  loadLorebookRecords,
  loadLorebookRecordsFromStorage,
  saveLorebookRecordsToStorage,
} from "./runtime/lorebook-storage";
import {
  loadPersonaRecords,
  loadPersonaRecordsFromStorage,
  savePersonaRecordsToStorage,
} from "./runtime/persona-storage";
import {
  loadProviderConnectionRecords,
  loadProviderConnectionRecordsFromStorage,
  saveProviderConnectionRecordsToStorage,
} from "./runtime/provider-connection-storage";
import {
  loadRippleStates,
  loadRippleStatesFromStorage,
  saveRippleStatesToStorage,
} from "./runtime/ripple-state-storage";
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

type StorageResult = {
  mode: MessengerStorageMode;
  status: Exclude<MessengerStorageStatus, "loading" | "saving">;
  message: string;
};

function mergeStorageResults(results: StorageResult[]) {
  return (
    results.find((result) => result.status === "error") ??
    results.find((result) => result.mode !== "unavailable") ??
    results[0]
  );
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
  const saveRequestId = useRef(0);
  const [careOpen, setCareOpen] = useState(false);
  const [careTab, setCareTab] = useState(0);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadAppSettingsFromStorage(remoteRuntimeUrl),
      loadCharacterRecordsFromStorage(remoteRuntimeUrl),
      loadPersonaRecordsFromStorage(remoteRuntimeUrl),
      loadLorebookRecordsFromStorage(remoteRuntimeUrl),
      loadProviderConnectionRecordsFromStorage(remoteRuntimeUrl),
      loadClassicThreadsFromStorage(remoteRuntimeUrl),
      loadMessengerThreadsFromStorage(remoteRuntimeUrl),
      loadRippleStatesFromStorage(remoteRuntimeUrl),
    ]).then(
      ([
        appSettingsSnapshot,
        characterSnapshot,
        personaSnapshot,
        lorebookSnapshot,
        providerConnectionSnapshot,
        classicSnapshot,
        messengerSnapshot,
        rippleSnapshot,
      ]) => {
        if (cancelled) return;
        const storageResult = mergeStorageResults([
          appSettingsSnapshot,
          characterSnapshot,
          personaSnapshot,
          lorebookSnapshot,
          providerConnectionSnapshot,
          classicSnapshot,
          messengerSnapshot,
          rippleSnapshot,
        ]);
        setAppSettings(appSettingsSnapshot.settings);
        setCharacters(characterSnapshot.records);
        setPersonas(personaSnapshot.records);
        setLorebooks(lorebookSnapshot.records);
        setProviderConnections(providerConnectionSnapshot.records);
        setClassicThreads(classicSnapshot.records);
        setMessengerThreads(messengerSnapshot.threads);
        setRippleStates(rippleSnapshot.states);
        setMessengerStorageMode(storageResult.mode);
        setMessengerStorageStatus(storageResult.status);
        setMessengerStorageMessage(storageResult.message);
        setStorageReady(storageResult.status === "ready");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [remoteRuntimeUrl]);

  // Coalesce rapid state changes (e.g. dragging a settings slider fires many
  // updateAppSettings calls) into a single host write. We debounce briefly, then
  // defer the write to an idle frame so the main thread stays responsive. The
  // saveRequestId guard below still ensures only the latest batch's result is
  // applied if multiple writes overlap.
  useEffect(() => {
    if (!storageReady) return;

    let idleHandle: IdleHandle | undefined;

    const timer = setTimeout(() => {
      const requestId = saveRequestId.current + 1;
      saveRequestId.current = requestId;

      idleHandle = requestIdle(() => {
        Promise.all([
          saveAppSettingsToStorage(appSettings, remoteRuntimeUrl),
          saveCharacterRecordsToStorage(characters, remoteRuntimeUrl),
          savePersonaRecordsToStorage(personas, remoteRuntimeUrl),
          saveLorebookRecordsToStorage(lorebooks, remoteRuntimeUrl),
          saveProviderConnectionRecordsToStorage(
            providerConnections,
            remoteRuntimeUrl,
          ),
          saveClassicThreadsToStorage(classicThreads, remoteRuntimeUrl),
          saveMessengerThreadsToStorage(messengerThreads, remoteRuntimeUrl),
          saveRippleStatesToStorage(rippleStates, remoteRuntimeUrl),
        ]).then((results) => {
          if (saveRequestId.current !== requestId) return;
          const storageResult = mergeStorageResults(results);
          setMessengerStorageMode(storageResult.mode);
          setMessengerStorageStatus(storageResult.status);
          setMessengerStorageMessage(storageResult.message);
        });
      });
    }, 150);

    return () => {
      if (timer !== undefined) clearTimeout(timer);
      if (idleHandle !== undefined) cancelIdle(idleHandle);
    };
  }, [
    appSettings,
    characters,
    classicThreads,
    lorebooks,
    messengerThreads,
    personas,
    providerConnections,
    remoteRuntimeUrl,
    rippleStates,
    storageReady,
  ]);

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

  const duplicateCharacter = useCallback(
    (characterId: string) => {
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
    },
    [characters],
  );

  const deleteCharacter = useCallback((characterId: string) => {
    const now = new Date().toISOString();
    setCharacters((currentCharacters) =>
      deleteCharacterRecord(currentCharacters, characterId),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) => {
        if (!thread.characterIds.includes(characterId)) return thread;

        const characterIds = thread.characterIds.filter(
          (id) => id !== characterId,
        );
        return {
          ...thread,
          characterIds,
          mode: characterIds.length > 1 ? "group" : "direct",
          updatedAt: now,
        };
      }),
    );
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) => {
        if (!thread.characterIds.includes(characterId)) return thread;

        return {
          ...thread,
          characterIds: thread.characterIds.filter((id) => id !== characterId),
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

  const duplicatePersona = useCallback(
    (personaId: string) => {
      const persona = personas.find(
        (currentPersona) => currentPersona.id === personaId,
      );
      if (!persona) return null;

      const now = new Date().toISOString();
      const duplicatedPersona = duplicatePersonaRecord(
        persona,
        createLocalId("persona"),
        now,
      );
      setPersonas((currentPersonas) => [duplicatedPersona, ...currentPersonas]);
      return duplicatedPersona;
    },
    [personas],
  );

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
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.activePersonaId === personaId
          ? { ...thread, activePersonaId: null, updatedAt: now }
          : thread,
      ),
    );
  }, []);

  const createLorebookEntry = useCallback(
    (lorebookId: string, input: LorebookEntryInput) => {
      if (!lorebooks.some((lorebook) => lorebook.id === lorebookId))
        return null;

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

  const createLorebook = useCallback((input: LorebookInput) => {
    const now = new Date().toISOString();
    const lorebook = createLorebookRecord({
      id: createLocalId("lorebook"),
      input,
      now,
    });
    setLorebooks((currentLorebooks) => [lorebook, ...currentLorebooks]);
    return lorebook;
  }, []);

  const updateLorebook = useCallback(
    (lorebookId: string, input: LorebookInput) => {
      const now = new Date().toISOString();
      setLorebooks((currentLorebooks) =>
        currentLorebooks.map((lorebook) =>
          lorebook.id === lorebookId
            ? updateLorebookRecord(lorebook, input, now)
            : lorebook,
        ),
      );
    },
    [],
  );

  const deleteLorebook = useCallback((lorebookId: string) => {
    const now = new Date().toISOString();
    setLorebooks((currentLorebooks) =>
      currentLorebooks.filter((lorebook) => lorebook.id !== lorebookId),
    );
    // Clear dangling lorebook references from threads, mirroring deleteCharacter.
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.lorebookIds.includes(lorebookId)
          ? {
              ...thread,
              lorebookIds: thread.lorebookIds.filter((id) => id !== lorebookId),
              updatedAt: now,
            }
          : thread,
      ),
    );
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.lorebookIds.includes(lorebookId)
          ? {
              ...thread,
              lorebookIds: thread.lorebookIds.filter((id) => id !== lorebookId),
              updatedAt: now,
            }
          : thread,
      ),
    );
  }, []);

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

  const duplicateProviderConnection = useCallback(
    (connectionId: string) => {
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
    },
    [providerConnections],
  );

  const deleteProviderConnection = useCallback(
    (connectionId: string) => {
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
      setClassicThreads((currentThreads) =>
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
    },
    [providerConnections],
  );

  const openClassicThread = useCallback((threadId: string) => {
    setSelectedSurface(CLASSIC);
    setView({ kind: "classic", threadId });
  }, []);

  const createClassicThread = useCallback(() => {
    const now = new Date().toISOString();
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
      id: createLocalId("classic-thread"),
      lorebookIds: lorebooks.map((lorebook) => lorebook.id),
      now,
      providerConnectionId: activeConnection?.id ?? null,
      title: `New Classic ${classicThreads.length + 1}`,
    });

    setClassicThreads((currentThreads) => [thread, ...currentThreads]);
    setSelectedSurface(CLASSIC);
    setView({ kind: "classic", threadId: thread.id });
    return thread;
  }, [
    appSettings.activeMessengerConnectionId,
    characters,
    classicThreads.length,
    lorebooks,
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

    const now = new Date().toISOString();
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === threadId
          ? renameClassicThreadRecord(thread, trimmedTitle, now)
          : thread,
      ),
    );
  }, []);

  const clearClassicThreadEntries = useCallback((threadId: string) => {
    const now = new Date().toISOString();
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
        currentStates.filter(
          (state) =>
            state.ownerKind !== "classic-thread" || state.ownerId !== threadId,
        ),
      );

      if (view.kind === "classic" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [view],
  );

  const openMessengerThread = useCallback((threadId: string) => {
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId });
  }, []);

  const createMessengerThread = useCallback(() => {
    const now = new Date().toISOString();
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

  const renameMessengerThread = useCallback(
    (threadId: string, title: string) => {
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
    },
    [],
  );

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
      setRippleStates((currentStates) =>
        currentStates.filter(
          (state) =>
            state.ownerKind !== "messenger-thread" ||
            state.ownerId !== threadId,
        ),
      );

      if (view.kind === "messenger" && view.threadId === threadId) {
        setView({ kind: "pond" });
      }
    },
    [view],
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
      const now = new Date().toISOString();
      const ripple = createRippleRecord({
        id: createLocalId("ripple"),
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
              id: createLocalId("ripple-state"),
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
      const now = new Date().toISOString();
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
      const now = new Date().toISOString();
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

  const createStorageBundle = useCallback(
    () =>
      createDeKoiStorageBundle({
        appSettings,
        characters,
        classicThreads,
        lorebooks,
        messengerThreads,
        personas,
        providerConnections,
        rippleStates,
      }),
    [
      appSettings,
      characters,
      classicThreads,
      lorebooks,
      messengerThreads,
      personas,
      providerConnections,
      rippleStates,
    ],
  );

  const importStorageBundle = useCallback(
    (bundle: DeKoiStorageBundle) => {
      const importedConnections = bundle.data.providerConnections;
      const importedSettings = { ...bundle.data.appSettings };
      const hasActiveConnection = importedConnections.some(
        (connection) =>
          connection.id === importedSettings.activeMessengerConnectionId,
      );
      const fallbackConnection =
        importedConnections[0] ?? providerConnections[0];

      if (!hasActiveConnection && fallbackConnection) {
        importedSettings.activeMessengerConnectionId = fallbackConnection.id;
      }

      setCharacters(bundle.data.characters);
      setPersonas(bundle.data.personas);
      setLorebooks(bundle.data.lorebooks);
      setProviderConnections(importedConnections);
      setClassicThreads(bundle.data.classicThreads);
      setMessengerThreads(bundle.data.messengerThreads);
      setRippleStates(bundle.data.rippleStates);
      setAppSettings(importedSettings);
      setMessengerStorageStatus("saving");
      setMessengerStorageMessage("Imported DeKoi bundle. Saving...");
      setSelectedSurface(MESSENGER);
      setView({ kind: "pond" });
    },
    [providerConnections],
  );

  const importLegacyData = useCallback((data: DeKoiLegacyImportData) => {
    const importedThreads = data.messengerThreads.map((thread) => {
      const id = createLocalId("messenger-thread");
      return {
        ...thread,
        id,
        messages: thread.messages.map((message) => ({
          ...message,
          threadId: id,
        })),
      };
    });
    const firstImportedThreadId = importedThreads[0]?.id ?? null;

    setMessengerThreads((currentThreads) => [
      ...importedThreads,
      ...currentThreads,
    ]);

    setMessengerStorageStatus("saving");
    setMessengerStorageMessage("Imported legacy threads. Saving...");
    setSelectedSurface(MESSENGER);
    setView(
      firstImportedThreadId
        ? { kind: "messenger", threadId: firstImportedThreadId }
        : { kind: "pond" },
    );
  }, []);

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

  const updateAppSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((currentSettings) => ({
      ...currentSettings,
      ...patch,
    }));
  }, []);

  const nav: NavContextType = {
    view,
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
