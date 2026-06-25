import type { NavContextType } from "./nav-context";
import { useAppState } from "./use-app-state";
import { useCareDrawerActions } from "./use-care-drawer-actions";
import { useCharacterActions } from "./use-character-actions";
import { useClassicThreadActions } from "./use-classic-thread-actions";
import { useLorebookActions } from "./use-lorebook-actions";
import { useMessengerThreadActions } from "./use-messenger-thread-actions";
import { usePersonaActions } from "./use-persona-actions";
import { useProviderConnectionActions } from "./use-provider-connection-actions";
import { useRippleActions } from "./use-ripple-actions";
import { useAppImportExportActions } from "./use-app-import-export-actions";
import { useAppSettingsActions } from "./use-app-settings-actions";
import { useAppStorageSync } from "./use-app-storage-sync";
import { useViewActions } from "./use-view-actions";

export function useNavigationController(): NavContextType {
  const {
    view,
    setView,
    sideRailView,
    setSideRailView,
    selectedSurface,
    setSelectedSurface,
    characters,
    setCharacters,
    personas,
    setPersonas,
    lorebooks,
    setLorebooks,
    providerConnections,
    setProviderConnections,
    classicThreads,
    setClassicThreads,
    messengerThreads,
    setMessengerThreads,
    rippleStates,
    setRippleStates,
    messengerStorageMode,
    setMessengerStorageMode,
    messengerStorageStatus,
    setMessengerStorageStatus,
    messengerStorageMessage,
    setMessengerStorageMessage,
    remoteRuntimeUrl,
    setRemoteRuntimeUrlState,
    appSettings,
    setAppSettings,
    storageReady,
    setStorageReady,
    careOpen,
    setCareOpen,
    careTab,
    setCareTab,
  } = useAppState();

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

  const { createStorageBundle, importStorageBundle, importLegacyData } =
    useAppImportExportActions({
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

  const { setCareOpen: setNavCareOpen, setCareTab: setNavCareTab } =
    useCareDrawerActions({
      careOpen,
      setCareOpen,
      setCareTab,
    });

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

  const { createPersona, updatePersona, duplicatePersona, deletePersona } =
    usePersonaActions({
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

  const {
    createClassicThread,
    updateClassicThread,
    renameClassicThread,
    clearClassicThreadEntries,
    deleteClassicThread,
  } = useClassicThreadActions({
    activeMessengerConnectionId: appSettings.activeMessengerConnectionId,
    characters,
    classicThreads,
    lorebooks,
    personas,
    providerConnections,
    setClassicThreads,
    setRippleStates,
    setView: setNavView,
    view,
    openClassicThread,
  });

  const {
    createMessengerThread,
    updateMessengerThread,
    renameMessengerThread,
    clearMessengerThreadMessages,
    deleteMessengerThread,
  } = useMessengerThreadActions({
    activeMessengerConnectionId: appSettings.activeMessengerConnectionId,
    characters,
    lorebooks,
    messengerThreads,
    personas,
    providerConnections,
    setMessengerThreads,
    setRippleStates,
    setView: setNavView,
    view,
    openMessengerThread,
  });

  const { getRippleState, createRipple, updateRipple, deleteRipple } =
    useRippleActions({
      rippleStates,
      setRippleStates,
    });

  return {
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
    setCareOpen: setNavCareOpen,
    setCareTab: setNavCareTab,
  };
}
