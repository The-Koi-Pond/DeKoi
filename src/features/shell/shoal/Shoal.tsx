import { ShoalRailRouter } from "./components/ShoalRailRouter";
import type { ShoalProps } from "./types";
import "./Shoal.css";

export function Shoal({ nav, onToggleShoal, shoalClosed }: ShoalProps) {
  return (
    <ShoalRailRouter
      key={nav.sideRailView}
      nav={nav}
      onToggleShoal={onToggleShoal}
      shoalClosed={shoalClosed}
    />
  );
}
