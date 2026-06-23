import { PondEye } from "./PondEye";
import "./hero.css";

import { useNav } from "../../../shared/ui/nav-context";

export function Hero() {
  const nav = useNav();
  return (
    <div className="hero">
      <PondEye />
      <div className="eyebrow">The Pond · character story engine</div>
      <h1>DeKoi</h1>
      <p className="sub">
        The pond is calm. <b>Dive into a pool</b> below, or resume a koi already
        swimming.
      </p>
      <div className="hero-cta">
        <button
          className="cta primary"
          onClick={() =>
            nav.setView({ kind: "bubble", threadId: "first-pond" })
          }
        >
          + Cast a line
        </button>
        <button
          className="cta ghost"
          onClick={() =>
            nav.setView({ kind: "bubble", threadId: "first-pond" })
          }
        >
          ↻ Resume a current
        </button>
      </div>
    </div>
  );
}
