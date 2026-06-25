import { KoiSprite } from "../../shared/ui/KoiSprite";
import { Waterline } from "./waterline";
import { Bank } from "./bank";
import { Shoal } from "./shoal";
import { Tide } from "./tide";
import { useEffect } from "react";
import { CareDrawer } from "./care";
import { Pond } from "./pond";
import type { NavContextType } from "../navigation";

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

      <Waterline nav={nav} />
      <Bank nav={nav} />
      <Shoal nav={nav} />
      <Pond nav={nav} />
      <Tide nav={nav} />
      <CareDrawer nav={nav} />
    </div>
  );
}
