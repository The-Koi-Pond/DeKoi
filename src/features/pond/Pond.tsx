import type { NavContextType } from "../../shared/ui/nav-context";
import { PondHome } from "./PondHome";
import { BubbleThread } from "../bubbles/BubbleThread";
import "./Pond.css";

interface PondProps {
  nav: NavContextType;
}

export function Pond({ nav }: PondProps) {
  return (
    <main className="pond">
      <div className="pond-banner">
        <span className="ic" aria-hidden="true">
          ◇
        </span>{" "}
        Cast a line to read the water — pick a koi from the Shoal to see its
        tracker
      </div>
      <div className="pond-inner">
        {nav.view.kind === "pond" ? <PondHome nav={nav} /> : <BubbleThread />}
      </div>
    </main>
  );
}
