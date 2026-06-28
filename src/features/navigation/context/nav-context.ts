import { createContext, useContext } from "react";
import type { NavContextType } from "./nav-types";

export type {
  NavActions,
  NavCareActions,
  NavCareState,
  NavCatalogState,
  NavCharacterActions,
  NavRoleplayThreadActions,
  NavContextType,
  NavLorebookActions,
  NavMessengerThreadActions,
  NavPersonaActions,
  NavProviderConnectionActions,
  NavRippleActions,
  NavRippleState,
  NavSettingsActions,
  NavSettingsState,
  NavStorageActions,
  NavState,
  NavStorageBundleActions,
  NavStorageState,
  NavStorageReloadResult,
  NavStorageStaleCheckResult,
  NavThreadState,
  NavViewActions,
  NavViewState,
  PondView,
  SideRailView,
} from "./nav-types";

export const NavContext = createContext<NavContextType>(null!);

export function useNav() {
  return useContext(NavContext);
}
