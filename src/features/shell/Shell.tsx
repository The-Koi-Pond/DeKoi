import { KoiSprite } from "../../shared/ui/KoiSprite";
import { Waterline, type WaterlineNav } from "./waterline";
import { Bank, type BankNav } from "./bank";
import { Shoal, type ShoalNav } from "./shoal";
import { Tide, type TideNav } from "./tide";
import { useEffect, useState } from "react";
import { CareDrawer, type CareDrawerNav } from "./care";
import { Pond, type PondNav } from "./pond";
import type { NavSettingsState } from "../navigation";

interface ShellProps {
  nav: ShellNav;
}

export type ShellNav = Pick<NavSettingsState, "appSettings"> &
  BankNav &
  CareDrawerNav &
  PondNav &
  ShoalNav &
  TideNav &
  WaterlineNav;

function applyPondAppearance(settings: ShellNav["appSettings"]) {
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
  const [shoalClosed, setShoalClosed] = useState(false);

  // Apply appearance settings whenever they change
  useEffect(() => {
    applyPondAppearance(nav.appSettings);
  }, [nav.appSettings]);

  return (
    <div
      className={`app${nav.careOpen ? " care-open" : ""}${
        shoalClosed ? " shoal-closed" : ""
      }`}
    >
      <KoiSprite />
      <div className="caustics" aria-hidden="true" />
      <div className="caustics b" aria-hidden="true" />

      <Waterline nav={nav} />
      <Bank nav={nav} onOpenShoal={() => setShoalClosed(false)} />
      <Shoal
        nav={nav}
        shoalClosed={shoalClosed}
        onToggleShoal={() => setShoalClosed((closed) => !closed)}
      />
      <Pond nav={nav} onOpenShoal={() => setShoalClosed(false)} />
      <Tide nav={nav} />
      <CareDrawer nav={nav} />
    </div>
  );
}
