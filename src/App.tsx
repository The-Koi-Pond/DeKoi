import { NavigationProvider } from "./features/navigation/NavigationProvider";
import { Shell } from "./features/shell/Shell";

export default function App() {
  return (
    <NavigationProvider>{(nav) => <Shell nav={nav} />}</NavigationProvider>
  );
}
