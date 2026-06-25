import { useState, useCallback } from "react";
import {
  NavContext,
  type PondView,
  type SideRailView,
  type NavContextType,
} from "./features/navigation/nav-context";
import { useAppStorageSync } from "./features/navigation/use-app-storage-sync";
import { currentIsoTimestamp } from "./shared/browser/current-time";
import { createRecordId } from "./shared/browser/record-id";
import { useEscapeKey } from "./shared/ui/use-escape-key";
import {
  createCharacterRecord,
  deleteCharacterRecord,
  duplicateCharacterRecord,
  removeCharacterLorebook,
  updateCharacterRecord,
  type CharacterRecordInput,
} from "./engine/character-actions";
import type { ClassicThread } from "./engine/classic";
import {
  clearClassicThreadPersona,
  clearClassicEntries,
  createClassicThread as buildClassicThread,
  deleteClassicThread as deleteClassicThreadRecord,
  removeClassicThreadCharacter,
  removeClassicThreadLorebook,
  replaceClassicThreadProviderConnection,
  renameClassicThread as renameClassicThreadRecord,
} from "./engine/classic-actions";
import {
  createLorebookEntryRecord,
  createLorebookRecord,
  deleteLorebookEntry,
  deleteLorebookRecord,
  duplicateLorebookEntryRecord,
  updateLorebookEntryRecord,
  updateLorebookRecord,
  upsertLorebookEntry,
  type LorebookEntryInput,
  type LorebookInput,
} from "./engine/lorebook-actions";
import type { MessengerThread } from "./engine/messenger";
import {
  clearMessengerThreadPersona,
  clearMessengerMessages,
  createMessengerThread as buildMessengerThread,
  deleteMessengerThread as deleteMessengerThreadRecord,
  removeMessengerThreadCharacter,
  removeMessengerThreadLorebook,
  replaceMessengerThreadProviderConnection,
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
  deleteRippleStateForOwner,
  updateRippleRecord,
  type RippleInput,
} from "./engine/ripple-actions";
import type { SurfaceId } from "./engine/surfaces";
import { CLASSIC, MESSENGER } from "./engine/surfaces";
import { Shell } from "./features/shell/Shell";
import {
  loadAppSettings,
  normalizeSurfaceStatus,
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
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "./runtime/messenger-storage";
import { loadCharacterRecords } from "./runtime/character-storage";
import { loadClassicThreads } from "./runtime/classic-storage";
import { loadLorebookRecords } from "./runtime/lorebook-storage";
import { loadPersonaRecords } from "./runtime/persona-storage";
import { loadProviderConnectionRecords } from "./runtime/provider-connection-storage";
import { loadRippleStates } from "./runtime/ripple-state-storage";
import {
  readRemoteRuntimeUrl,
  writeRemoteRuntimeUrl,
} from "./runtime/runtime-target";

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

  const closeCareDrawer = useCallback(() => setCareOpen(false), []);
  useEscapeKey(careOpen, closeCareDrawer);

  const createCharacter = useCallback((input: CharacterRecordInput) => {
    const now = currentIsoTimestamp();
    const character = createCharacterRecord({
      id: createRecordId("character"),
      input,
      now,
    });
    setCharacters((currentCharacters) => [character, ...currentCharacters]);
    return character;
  }, []);

  const updateCharacter = useCallback(
    (characterId: string, input: CharacterRecordInput) => {
      const now = currentIsoTimestamp();
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

      const now = currentIsoTimestamp();
      const duplicatedCharacter = duplicateCharacterRecord(
        character,
        createRecordId("character"),
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
    const now = currentIsoTimestamp();
    setCharacters((currentCharacters) =>
      deleteCharacterRecord(currentCharacters, characterId),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        removeMessengerThreadCharacter(thread, characterId, now),
      ),
    );
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        removeClassicThreadCharacter(thread, characterId, now),
      ),
    );
  }, []);

  const createPersona = useCallback((input: PersonaRecordInput) => {
    const now = currentIsoTimestamp();
    const persona = createPersonaRecord({
      id: createRecordId("persona"),
      input,
      now,
    });
    setPersonas((currentPersonas) => [persona, ...currentPersonas]);
    return persona;
  }, []);

  const updatePersona = useCallback(
    (personaId: string, input: PersonaRecordInput) => {
      const now = currentIsoTimestamp();
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

      const now = currentIsoTimestamp();
      const duplicatedPersona = duplicatePersonaRecord(
        persona,
        createRecordId("persona"),
        now,
      );
      setPersonas((currentPersonas) => [duplicatedPersona, ...currentPersonas]);
      return duplicatedPersona;
    },
    [personas],
  );

  const deletePersona = useCallback((personaId: string) => {
    const now = currentIsoTimestamp();
    setPersonas((currentPersonas) =>
      deletePersonaRecord(currentPersonas, personaId),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        clearMessengerThreadPersona(thread, personaId, now),
      ),
    );
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        clearClassicThreadPersona(thread, personaId, now),
      ),
    );
  }, []);

  const createLorebookEntry = useCallback(
    (lorebookId: string, input: LorebookEntryInput) => {
      if (!lorebooks.some((lorebook) => lorebook.id === lorebookId))
        return null;

      const now = currentIsoTimestamp();
      const entry = createLorebookEntryRecord({
        id: createRecordId("lore-entry"),
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
      const now = currentIsoTimestamp();
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

      const now = currentIsoTimestamp();
      const duplicatedEntry = duplicateLorebookEntryRecord(
        entry,
        createRecordId("lore-entry"),
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
      const now = currentIsoTimestamp();
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
    const now = currentIsoTimestamp();
    const lorebook = createLorebookRecord({
      id: createRecordId("lorebook"),
      input,
      now,
    });
    setLorebooks((currentLorebooks) => [lorebook, ...currentLorebooks]);
    return lorebook;
  }, []);

  const updateLorebook = useCallback(
    (lorebookId: string, input: LorebookInput) => {
      const now = currentIsoTimestamp();
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
    const now = currentIsoTimestamp();
    setLorebooks((currentLorebooks) =>
      deleteLorebookRecord(currentLorebooks, lorebookId),
    );
    setCharacters((currentCharacters) =>
      currentCharacters.map((character) =>
        removeCharacterLorebook(character, lorebookId, now),
      ),
    );
    setMessengerThreads((currentThreads) =>
      currentThreads.map((thread) =>
        removeMessengerThreadLorebook(thread, lorebookId, now),
      ),
    );
    setClassicThreads((currentThreads) =>
      currentThreads.map((thread) =>
        removeClassicThreadLorebook(thread, lorebookId, now),
      ),
    );
  }, []);

  const createProviderConnection = useCallback(
    (input: ProviderConnectionInput) => {
      const now = currentIsoTimestamp();
      const connection = createProviderConnectionRecord({
        id: createRecordId("connection"),
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
      const now = currentIsoTimestamp();
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

      const now = currentIsoTimestamp();
      const duplicatedConnection = duplicateProviderConnectionRecord(
        connection,
        createRecordId("connection"),
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
      const now = currentIsoTimestamp();
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
          replaceMessengerThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection.id,
            now,
          ),
        ),
      );
      setClassicThreads((currentThreads) =>
        currentThreads.map((thread) =>
          replaceClassicThreadProviderConnection(
            thread,
            connectionId,
            fallbackConnection.id,
            now,
          ),
        ),
      );
    },
    [providerConnections],
  );

  const openClassicThread = useCallback((threadId: string) => {
    setSideRailView("shoal");
    setSelectedSurface(CLASSIC);
    setView({ kind: "classic", threadId });
  }, []);

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
    setSideRailView("shoal");
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
        setView({ kind: "pond" });
      }
    },
    [view],
  );

  const openMessengerThread = useCallback((threadId: string) => {
    setSideRailView("shoal");
    setSelectedSurface(MESSENGER);
    setView({ kind: "messenger", threadId });
  }, []);

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
    setSideRailView("shoal");
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
      const id = createRecordId("messenger-thread");
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
    setView: useCallback((v: PondView) => setView(v), []),
    setSideRailView: useCallback((v: SideRailView) => setSideRailView(v), []),
    setSelectedSurface: useCallback(
      (s: SurfaceId) => {
        setSideRailView("shoal");
        setSelectedSurface(s);
      },
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
