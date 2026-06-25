import type { NavContextType } from "../../navigation";
import { Hero } from "./hero/Hero";
import { ModePools } from "./pools/ModePools";
import { RecentCurrents } from "./currents/RecentCurrents";
import { Depths } from "./depths/Depths";

interface PondHomeProps {
  nav: NavContextType;
}

export function PondHome({ nav }: PondHomeProps) {
  return (
    <>
      <Hero nav={nav} />
      <div className="pond-divider" aria-hidden="true">
        <img src="/lotus-divider.svg" alt="" />
      </div>
      <ModePools nav={nav} />
      <RecentCurrents nav={nav} />
      <Depths nav={nav} />
    </>
  );
}
