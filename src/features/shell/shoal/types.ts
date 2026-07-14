import type {
  NavCatalogState,
  NavMessengerThreadActions,
  NavPromptPresetActions,
  NavRoleplayThreadActions,
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";

export type ShoalNav = Pick<
  NavCatalogState,
  | "characters"
  | "lorebooks"
  | "personas"
  | "promptPresets"
  | "promptPresetFileHost"
  | "promptPresetFileStatus"
  | "providerConnections"
> &
  Pick<
    NavPromptPresetActions,
    | "exportPromptPresetFile"
    | "importPromptPresetFile"
    | "openPromptPresetFile"
    | "restoreStarterPromptPreset"
    | "setPromptPresetFileStatus"
  > &
  Pick<
    NavRoleplayThreadActions,
    | "createRoleplayThread"
    | "deleteRoleplayThread"
    | "renameRoleplayThread"
    | "updateRoleplayThread"
    | "updateRoleplayThreadById"
    | "roleplayPromptPresetRepairNotices"
    | "clearRoleplayPromptPresetRepairNotice"
  > &
  Pick<
    NavMessengerThreadActions,
    | "createMessengerThread"
    | "deleteMessengerThread"
    | "renameMessengerThread"
    | "updateMessengerThread"
    | "updateMessengerThreadById"
    | "messengerPromptPresetRepairNotices"
    | "clearMessengerPromptPresetRepairNotice"
  > &
  Pick<
    NavSettingsActions,
    "setActiveMessengerConnectionId" | "setShoalSortMode" | "updateAppSettings"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "modeThreads"> &
  Pick<
    NavViewActions,
    "openRoleplayThread" | "openMessengerThread" | "setSideRailView" | "setView"
  > &
  Pick<NavViewState, "selectedSurface" | "sideRailView" | "view">;

export interface ShoalProps {
  nav: ShoalNav;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export interface ShoalRailProps extends ShoalProps {
  chatSettingsOpen: boolean;
  onCloseChatSettings: () => void;
  onOpenChatSettings: () => void;
}

export type ThreadReleaseRequest = {
  id: string;
  kind: "roleplay" | "messenger";
  title: string;
};
