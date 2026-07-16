import { useCallback } from "react";
import type { ProviderConnectionId } from "../../../engine/contracts/types/provider-connection";
import type { SurfaceId } from "../../../engine/contracts/constants/surfaces";
import {
  normalizeSurfaceStatus,
  type AppSettings,
  type AppSettingsPatch,
  type ShoalSortMode,
} from "../../../engine/contracts/types/app-settings";
import { type AppStorageSyncStatus, writeRuntimeTargetUrl } from "../../runtime";
import type { StateSetter } from "../../../shared/react/state-setter";

type UseAppSettingsActionsInput = {
  remoteRuntimeUrl: string;
  setAppSettings: StateSetter<AppSettings>;
  setRemoteRuntimeUrlState: StateSetter<string>;
  setStorageReady: StateSetter<boolean>;
  setAppStorageStatus: StateSetter<AppStorageSyncStatus>;
  setAppStorageMessage: StateSetter<string>;
  prepareForStorageReplacement: () => boolean;
};

export function useAppSettingsActions({
  remoteRuntimeUrl,
  setAppSettings,
  setRemoteRuntimeUrlState,
  setStorageReady,
  setAppStorageStatus,
  setAppStorageMessage,
  prepareForStorageReplacement,
}: UseAppSettingsActionsInput) {
  const setRemoteRuntimeUrl = useCallback(
    (url: string) => {
      if (url.trim() === remoteRuntimeUrl) return true;
      if (!prepareForStorageReplacement()) return false;
      const runtimeTargetUrl = writeRuntimeTargetUrl(url);
      setStorageReady(false);
      setAppStorageStatus("loading");
      setAppStorageMessage("Loading app storage.");
      setRemoteRuntimeUrlState(runtimeTargetUrl);
      return true;
    },
    [
      setAppStorageMessage,
      setAppStorageStatus,
      setRemoteRuntimeUrlState,
      setStorageReady,
      prepareForStorageReplacement,
      remoteRuntimeUrl,
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
    (patch: AppSettingsPatch) => {
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
