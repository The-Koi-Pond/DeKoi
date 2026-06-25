import { NavContext } from "./features/navigation/nav-context";
import { useNavigationController } from "./features/navigation/use-navigation-controller";
import { Shell } from "./features/shell/Shell";

export default function App() {
  const nav = useNavigationController();

  return (
    <NavContext.Provider value={nav}>
      <Shell nav={nav} />
    </NavContext.Provider>
  );
}
