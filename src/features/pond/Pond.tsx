import type { NavContextType } from "../../shared/ui/nav-context";
import { PondHome } from "./PondHome";
import { BubbleThread } from "../bubbles/BubbleThread";
import "./Pond.css";

interface PondProps {
  nav: NavContextType;
}

export function Pond({ nav }: PondProps) {
  const inBubble = nav.view.kind === "bubble";
  // The banner copy is contextual: the "pick a koi" hint is for the Pond home;
  // once inside a Bubble it would be misleading, so show a calmer status line.
  const banner = inBubble
    ? "Reading the water — your Bubble is saved locally as you swim."
    : "Cast a line to read the water — pick a koi from the Shoal to see its tracker.";

  return (
    <main className="pond">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">
          ◇
        </span>{" "}
        {banner}
      </div>
      <div className="pond-inner">
        {inBubble ? <BubbleThread /> : <PondHome nav={nav} />}
      </div>
    </main>
  );
}
