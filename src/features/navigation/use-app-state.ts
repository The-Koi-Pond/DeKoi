import { useState } from "react";
import type { ClassicThread } from "../../engine/classic";
import type { MessengerThread } from "../../engine/messenger";
import type { RippleState } from "../../engine/ripples";
import type { SurfaceId } from "../../engine/surfaces";
import { MESSENGER } from "../../engine/surfaces";
import { loadAppSettings, type AppSettings } from "../../runtime/app-settings";
import { loadCharacterRecords } from "../../runtime/character-storage";
import { loadClassicThreads } from "../../runtime/classic-storage";
import { loadLorebookRecords } from "../../runtime/lorebook-storage";
import {
  loadInitialMessengerThreads,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../../runtime/messenger-storage";
import { loadPersonaRecords } from "../../runtime/persona-storage";
import { loadProviderConnectionRecords } from "../../runtime/provider-connection-storage";
import { loadRippleStates } from "../../runtime/ripple-state-storage";
import { readRemoteRuntimeUrl } from "../../shared/api/runtime-target";
import type { PondView, SideRailView } from "./nav-types";

export function useAppState() {
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

  return {
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
  };
}
