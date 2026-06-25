import { useState } from "react";
import {
  loadInitialAppStorageRecords,
  readRuntimeTargetUrl,
  type AppStorageRecords,
  type MessengerStorageMode,
  type MessengerStorageStatus,
} from "../features/runtime";
import type {
  NavViewState,
  PondView,
  SideRailView,
} from "../features/navigation";

type SurfaceId = NavViewState["selectedSurface"];

const MESSENGER_SURFACE: SurfaceId = "messenger";

export function useAppState() {
  const [initialStorageRecords] = useState(loadInitialAppStorageRecords);
  const [view, setView] = useState<PondView>({ kind: "pond" });
  const [sideRailView, setSideRailView] = useState<SideRailView>("shoal");
  const [selectedSurface, setSelectedSurface] =
    useState<SurfaceId>(MESSENGER_SURFACE);
  const [characters, setCharacters] = useState(initialStorageRecords.characters);
  const [personas, setPersonas] = useState(initialStorageRecords.personas);
  const [lorebooks, setLorebooks] = useState(initialStorageRecords.lorebooks);
  const [providerConnections, setProviderConnections] = useState(
    initialStorageRecords.providerConnections,
  );
  const [classicThreads, setClassicThreads] = useState(
    initialStorageRecords.classicThreads,
  );
  const [messengerThreads, setMessengerThreads] = useState(
    initialStorageRecords.messengerThreads,
  );
  const [rippleStates, setRippleStates] = useState(
    initialStorageRecords.rippleStates,
  );
  const [messengerStorageMode, setMessengerStorageMode] =
    useState<MessengerStorageMode>("unavailable");
  const [messengerStorageStatus, setMessengerStorageStatus] =
    useState<MessengerStorageStatus>("loading");
  const [messengerStorageMessage, setMessengerStorageMessage] = useState(
    "Loading Messenger storage.",
  );
  const [remoteRuntimeUrl, setRemoteRuntimeUrlState] =
    useState(readRuntimeTargetUrl);
  const [appSettings, setAppSettings] = useState<
    AppStorageRecords["appSettings"]
  >(initialStorageRecords.appSettings);
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
