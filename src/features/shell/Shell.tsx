import { KoiSprite } from "../../shared/ui/KoiSprite";
import { Waterline } from "./waterline/Waterline";
import { Bank } from "./bank/Bank";
import { Shoal } from "./shoal/Shoal";
import { Tide } from "./tide/Tide";
import { useEffect } from "react";
import { CareDrawer } from "./care/CareDrawer";
import { Pond } from "../pond/Pond";
import type { NavContextType } from "../../shared/ui/nav-context";

interface ShellProps {
  nav: NavContextType;
}

function applyPondAppearance(settings: NavContextType["appSettings"]) {
  const root = document.documentElement;

  // Accent → data attribute (CSS maps it to --accent/--accent-hot/--accent-deep)
  root.setAttribute("data-accent", settings.accent);

  // Font scale → CSS custom property
  root.style.setProperty("--font-scale", String(settings.fontScale / 100));

  // Density → data attribute
  root.setAttribute("data-density", settings.density);

  // Motion → data attribute
  root.setAttribute("data-motion", settings.motion);
}

export function Shell({ nav }: ShellProps) {
  // Apply appearance settings whenever they change
  useEffect(() => {
    applyPondAppearance(nav.appSettings);
  }, [nav.appSettings]);

  return (
    <div className="app">
      <KoiSprite />
      <div className="caustics" aria-hidden="true" />
      <div className="caustics b" aria-hidden="true" />

      <Waterline />
      <Bank />
      <Shoal />
      <Pond nav={nav} />
      <Tide nav={nav} />
      <CareDrawer nav={nav} />
    </div>
  );
}
