import type { ReactNode } from "react";
import { NavContext, type NavContextType } from "../features/navigation";
import { useAppController } from "./use-app-controller";

type AppProvidersProps = {
  children: (nav: NavContextType) => ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const nav = useAppController();

  return (
    <NavContext.Provider value={nav}>{children(nav)}</NavContext.Provider>
  );
}
