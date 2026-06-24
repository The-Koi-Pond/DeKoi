import type { NavContextType } from "../../shared/ui/nav-context";
import { ClassicThread } from "../classic/ClassicThread";
import { PondHome } from "./PondHome";
import { MessengerThread } from "../messenger/MessengerThread";
import "./Pond.css";

interface PondProps {
  nav: NavContextType;
}

export function Pond({ nav }: PondProps) {
  const inMessenger = nav.view.kind === "messenger";
  const inClassic = nav.view.kind === "classic";
  const storagePhrase =
    nav.messengerStorageMode === "remote" && nav.messengerStorageStatus !== "error"
      ? "through the remote runtime"
      : "locally";
  // The banner copy is contextual: the "pick a koi" hint is for the Pond home;
  // once inside Messenger it would be misleading, so show a calmer status line.
  const banner = inMessenger
    ? `Reading the water — your Messenger thread is saved ${storagePhrase} as you swim.`
    : inClassic
      ? "Classic scene current — write the scene, then generate the next turn through the shared runtime."
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
        {inMessenger ? (
          <MessengerThread />
        ) : inClassic ? (
          <ClassicThread />
        ) : (
          <PondHome nav={nav} />
        )}
      </div>
    </main>
  );
}
