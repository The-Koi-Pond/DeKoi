import {
  useCharacterActions,
  useLorebookActions,
  usePersonaActions,
  useProviderConnectionActions,
} from "../features/catalog";
import {
  useRoleplayThreadActions,
  useMessengerThreadActions,
} from "../features/modes";
import { type NavContextType } from "../features/navigation";
import {
  useAppImportExportActions,
  useAppSettingsActions,
  useCareDrawerActions,
} from "../features/shell";
import { useAppState } from "./use-app-state";
import { useAppStorageSync } from "./use-app-storage-sync";
import { useRippleActions } from "./use-ripple-actions";
import { useViewActions } from "./use-view-actions";

export function useAppController(): NavContextType {
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
    roleplayThreads,
    setRoleplayThreads,
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
    openRoleplayThread,
    openMessengerThread,
  } = useViewActions({
    setView,
    setSideRailView,
    setSelectedSurface,
  });

  const {
    checkAppStorageStale,
    commitAppStorageImport,
    flushAppStorageSaves,
    importRecoveryState,
    reloadAppStorage,
    restoreLastPreImportBackup,
    storageHasUnsavedChanges,
  } = useAppStorageSync({
    appSettings,
    characters,
    personas,
    lorebooks,
    providerConnections,
    roleplayThreads,
    messengerThreads,
    rippleStates,
    remoteRuntimeUrl,
    setAppSettings,
    setCharacters,
    setPersonas,
    setLorebooks,
    setProviderConnections,
    setRoleplayThreads,
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
      roleplayThreads,
      messengerThreads,
      rippleStates,
      setSelectedSurface,
      setView: setNavView,
      commitAppStorageImport,
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
    setRoleplayThreads,
    setMessengerThreads,
  });

  const { createPersona, updatePersona, duplicatePersona, deletePersona } =
    usePersonaActions({
      personas,
      setPersonas,
      setRoleplayThreads,
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
    setRoleplayThreads,
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
    setRoleplayThreads,
    setMessengerThreads,
  });

  const {
    createRoleplayThread,
    updateRoleplayThread,
    renameRoleplayThread,
    clearRoleplayThreadEntries,
    deleteRoleplayThread,
  } = useRoleplayThreadActions({
    activeMessengerConnectionId: appSettings.activeMessengerConnectionId,
    characters,
    roleplayThreads,
    lorebooks,
    personas,
    providerConnections,
    setRoleplayThreads,
    setRippleStates,
    setView: setNavView,
    view,
    openRoleplayThread,
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
    messengerThreads,
    personas,
    providerConnections,
    setMessengerThreads,
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
    roleplayThreads,
    messengerThreads,
    messengerStorageMode,
    messengerStorageStatus,
    messengerStorageMessage,
    storageHasUnsavedChanges,
    importRecoveryState,
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
    createRoleplayThread,
    updateRoleplayThread,
    renameRoleplayThread,
    clearRoleplayThreadEntries,
    deleteRoleplayThread,
    openRoleplayThread,
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
    checkAppStorageStale,
    flushAppStorageSaves,
    importStorageBundle,
    importLegacyData,
    reloadAppStorage,
    restoreLastPreImportBackup,
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
