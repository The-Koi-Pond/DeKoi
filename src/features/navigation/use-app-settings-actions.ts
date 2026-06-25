import { useCallback } from "react";
import type { ProviderConnectionId } from "../../engine/provider-connection";
import type { SurfaceId } from "../../engine/surfaces";
import {
  normalizeSurfaceStatus,
  type AppSettings,
  type ShoalSortMode,
} from "../../runtime/app-settings";
import {
  readRemoteRuntimeUrl,
  writeRemoteRuntimeUrl,
} from "../../shared/api/runtime-target";
import type { MessengerStorageStatus } from "../../runtime/messenger-storage";
import type { StateSetter } from "./state-setter";

type UseAppSettingsActionsInput = {
  setAppSettings: StateSetter<AppSettings>;
  setRemoteRuntimeUrlState: StateSetter<string>;
  setStorageReady: StateSetter<boolean>;
  setMessengerStorageStatus: StateSetter<MessengerStorageStatus>;
  setMessengerStorageMessage: StateSetter<string>;
};

export function useAppSettingsActions({
  setAppSettings,
  setRemoteRuntimeUrlState,
  setStorageReady,
  setMessengerStorageStatus,
  setMessengerStorageMessage,
}: UseAppSettingsActionsInput) {
  const setRemoteRuntimeUrl = useCallback(
    (url: string) => {
      writeRemoteRuntimeUrl(url);
      setStorageReady(false);
      setMessengerStorageStatus("loading");
      setMessengerStorageMessage("Loading Messenger storage.");
      setRemoteRuntimeUrlState(readRemoteRuntimeUrl());
    },
    [
      setMessengerStorageMessage,
      setMessengerStorageStatus,
      setRemoteRuntimeUrlState,
      setStorageReady,
    ],
  );

  const setSendOnEnterSurface = useCallback(
    (surface: SurfaceId) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        sendOnEnterSurface: surface,
      }));
    },
    [setAppSettings],
  );

  const setConfirmRelease = useCallback(
    (confirmRelease: boolean) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        confirmRelease,
      }));
    },
    [setAppSettings],
  );

  const setSurfaceStatus = useCallback(
    (surfaceStatus: string) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        surfaceStatus: normalizeSurfaceStatus(surfaceStatus),
      }));
    },
    [setAppSettings],
  );

  const setShoalSortMode = useCallback(
    (shoalSortMode: ShoalSortMode) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        shoalSortMode,
      }));
    },
    [setAppSettings],
  );

  const setActiveMessengerConnectionId = useCallback(
    (activeMessengerConnectionId: ProviderConnectionId) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        activeMessengerConnectionId,
      }));
    },
    [setAppSettings],
  );

  const updateAppSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setAppSettings((currentSettings) => ({
        ...currentSettings,
        ...patch,
      }));
    },
    [setAppSettings],
  );

  return {
    setRemoteRuntimeUrl,
    setSendOnEnterSurface,
    setConfirmRelease,
    setSurfaceStatus,
    setShoalSortMode,
    setActiveMessengerConnectionId,
    updateAppSettings,
  };
}
