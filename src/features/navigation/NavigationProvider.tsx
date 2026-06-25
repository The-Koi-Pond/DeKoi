import type { ReactNode } from "react";
import { NavContext } from "./nav-context";
import type { NavContextType } from "./nav-types";
import { useNavigationController } from "./use-navigation-controller";

type NavigationProviderProps = {
  children: (nav: NavContextType) => ReactNode;
};

export function NavigationProvider({ children }: NavigationProviderProps) {
  const nav = useNavigationController();

  return (
    <NavContext.Provider value={nav}>{children(nav)}</NavContext.Provider>
  );
}
