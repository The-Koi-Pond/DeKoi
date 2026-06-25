import type { ReactNode } from "react";
import { NavContext } from "../features/navigation/nav-context";
import type { NavContextType } from "../features/navigation/nav-types";
import { useNavigationController } from "../features/navigation/use-navigation-controller";

type AppProvidersProps = {
  children: (nav: NavContextType) => ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const nav = useNavigationController();

  return (
    <NavContext.Provider value={nav}>{children(nav)}</NavContext.Provider>
  );
}
