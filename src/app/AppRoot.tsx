import { Shell } from "../features/shell/Shell";
import { AppProviders } from "./AppProviders";

export function AppRoot() {
  return <AppProviders>{(nav) => <Shell nav={nav} />}</AppProviders>;
}
