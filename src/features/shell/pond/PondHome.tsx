import { Hero } from "./hero/Hero";
import { ModePools, type ModePoolsNav } from "./pools/ModePools";
import {
  RecentCurrents,
  type RecentCurrentsNav,
} from "./currents/RecentCurrents";
import { Depths, type DepthsNav } from "./depths/Depths";

interface PondHomeProps {
  nav: PondHomeNav;
}

export type PondHomeNav = DepthsNav &
  ModePoolsNav &
  RecentCurrentsNav;

export function PondHome({ nav }: PondHomeProps) {
  return (
    <>
      <Hero />
      <div className="pond-divider" aria-hidden="true">
        <img src="/lotus-divider.svg" alt="" />
      </div>
      <ModePools nav={nav} />
      <RecentCurrents nav={nav} />
      <Depths nav={nav} />
    </>
  );
}
