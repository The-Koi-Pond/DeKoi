import { useCallback } from "react";
import type { ProviderConnectionId } from "../../../engine/contracts/types/provider-connection";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import {
  normalizeSurfaceStatus,
  type AppSettings,
  type ShoalSortMode,
} from "../../../engine/contracts/types/app-settings";
import {
  type MessengerStorageStatus,
  writeRuntimeTargetUrl,
} from "../../runtime";
import type { StateSetter } from "../../../shared/react/state-setter";

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
      const runtimeTargetUrl = writeRuntimeTargetUrl(url);
      setStorageReady(false);
      setMessengerStorageStatus("loading");
      setMessengerStorageMessage("Loading Messenger storage.");
      setRemoteRuntimeUrlState(runtimeTargetUrl);
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
