import { PondEye } from "./PondEye";
import "./hero.css";

import { useNav } from "../../../navigation";
import {
  sortClassicThreadsByUpdatedAt,
  sortMessengerThreadsByUpdatedAt,
} from "../../../modes";

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
          onClick={() => nav.createMessengerThread()}
        >
          + Cast a line
        </button>
        <button
          className="cta ghost"
          onClick={() => {
            const latestThread = sortMessengerThreadsByUpdatedAt(
              nav.messengerThreads,
            )[0];
            const latestClassicThread = sortClassicThreadsByUpdatedAt(
              nav.classicThreads,
            )[0];

            if (
              latestClassicThread &&
              (!latestThread ||
                latestClassicThread.updatedAt.localeCompare(latestThread.updatedAt) > 0)
            ) {
              nav.openClassicThread(latestClassicThread.id);
              return;
            }

            if (latestThread) {
              nav.openMessengerThread(latestThread.id);
              return;
            }

            nav.createMessengerThread();
          }}
        >
          ↻ Resume a current
        </button>
      </div>
    </div>
  );
}
