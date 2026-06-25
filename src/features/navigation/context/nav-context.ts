import { createContext, useContext } from "react";
import type { NavContextType } from "./nav-types";

export type {
  NavContextType,
  NavState,
  PondView,
  SideRailView,
} from "./nav-types";

export const NavContext = createContext<NavContextType>(null!);

export function useNav() {
  return useContext(NavContext);
}
