import type { ReactNode } from "react";
import {
  NavContext,
  type NavContextType,
  useNavigationController,
} from "../features/navigation";

type AppProvidersProps = {
  children: (nav: NavContextType) => ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const nav = useNavigationController();

  return (
    <NavContext.Provider value={nav}>{children(nav)}</NavContext.Provider>
  );
}
