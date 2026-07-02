import type {
  NavCatalogState,
  NavMessengerThreadActions,
  NavRoleplayThreadActions,
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../navigation";

export type ShoalNav = Pick<
  NavCatalogState,
  "characters" | "lorebooks" | "personas" | "providerConnections"
> &
  Pick<
    NavRoleplayThreadActions,
    | "createRoleplayThread"
    | "deleteRoleplayThread"
    | "renameRoleplayThread"
    | "updateRoleplayThread"
  > &
  Pick<
    NavMessengerThreadActions,
    | "createMessengerThread"
    | "deleteMessengerThread"
    | "renameMessengerThread"
    | "updateMessengerThread"
  > &
  Pick<
    NavSettingsActions,
    "setActiveMessengerConnectionId" | "setShoalSortMode" | "updateAppSettings"
  > &
  Pick<NavSettingsState, "appSettings"> &
  Pick<NavThreadState, "roleplayThreads" | "messengerThreads"> &
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
