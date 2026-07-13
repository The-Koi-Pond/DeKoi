import type {
  NavCareActions,
  NavCareState,
  NavCatalogState,
  NavLoreRuntimeState,
  NavMacroVariableState,
  NavRippleState,
  NavSettingsActions,
  NavSettingsState,
  NavStorageActions,
  NavStorageBundleActions,
  NavStorageState,
  NavThreadState,
} from "../../navigation";
import type { AppStorageRepairStrategy } from "../../runtime";

export type CareDrawerNav = Pick<NavCareActions, "setCareOpen" | "setCareTab"> &
  Pick<NavCareState, "careOpen" | "careTab"> &
  Pick<
    NavCatalogState,
    "characters" | "lorebooks" | "personas" | "promptPresets" | "providerConnections"
  > &
  Pick<NavLoreRuntimeState, "loreRuntimeStates"> &
  Pick<NavMacroVariableState, "macroVariableStates"> &
  Pick<NavRippleState, "rippleStates"> &
  Pick<
    NavSettingsActions,
    "setConfirmRelease" | "setRemoteRuntimeUrl" | "setSendOnEnterSurface" | "updateAppSettings"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<
    NavStorageBundleActions,
    "createStorageBundle" | "importLegacyData" | "importStorageBundle"
  > &
  Pick<
    NavStorageActions,
    | "checkAppStorageStale"
    | "flushAppStorageSaves"
    | "reloadAppStorage"
    | "restoreLastPreImportBackup"
  > &
  Pick<
    NavStorageState,
    | "importRecoveryState"
    | "messengerStorageMessage"
    | "messengerStorageMode"
    | "messengerStorageStatus"
    | "storageHasUnsavedChanges"
    | "droppedRecordCountByCollection"
    | "storageLoadErrorMessageByCollection"
    | "remoteRuntimeUrl"
  > &
  Pick<NavThreadState, "roleplayThreads" | "messengerThreads">;

export type StorageImportFailureSource = "bundle" | "legacy";

export type StorageRepairConfirmationAction = AppStorageRepairStrategy | "finish-repair";

export interface StorageRepairActionState {
  entity: string;
  action: StorageRepairConfirmationAction;
}
