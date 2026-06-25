import { NavigationProvider } from "../features/navigation/NavigationProvider";
import { Shell } from "../features/shell/Shell";

export function AppRoot() {
  return (
    <NavigationProvider>{(nav) => <Shell nav={nav} />}</NavigationProvider>
  );
}
