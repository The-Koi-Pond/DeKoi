import { createContext } from "react";
import type { NavContextType } from "./nav-types";

export type { NavContextType } from "./nav-types";

export const NavContext = createContext<NavContextType>(null!);
