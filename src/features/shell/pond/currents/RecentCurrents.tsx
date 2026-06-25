import { SURFACES } from "../../../../engine/surfaces";
import type { NavThreadState, NavViewActions } from "../../../navigation";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  getMessengerThreadTimeLabel,
  sortMessengerThreadsByUpdatedAt,
} from "../../../modes";
import "./currents.css";

interface RecentCurrentsProps {
  nav: RecentCurrentsNav;
}

export type RecentCurrentsNav = Pick<
  NavThreadState,
  "messengerThreads"
> &
  Pick<NavViewActions, "openMessengerThread">;

export function RecentCurrents({ nav }: RecentCurrentsProps) {
  const recentThreads = sortMessengerThreadsByUpdatedAt(nav.messengerThreads).slice(
    0,
    3,
  );

  return (
    <>
      <div className="section-head">
        <span className="eyebrow">Recent currents</span>
        <span className="hint">koi you were swimming with</span>
        <span className="more">See the whole shoal →</span>
      </div>
      <div className="current">
        {recentThreads.map((thread) => (
          <div
            key={thread.id}
            className="drifter"
            role="button"
            tabIndex={0}
            onClick={() => nav.openMessengerThread(thread.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                nav.openMessengerThread(thread.id);
              }
            }}
          >
            <div
              className="da"
              style={{
                background: "linear-gradient(140deg,#f6a15a,#e06a2b)",
              }}
            >
              {getMessengerThreadInitials(thread.title)}
            </div>
            <div className="db">
              <div className="dt">
                <span className="dn">{thread.title}</span>
                <span className="dtime">
                  {getMessengerThreadTimeLabel(thread.updatedAt)}
                </span>
              </div>
              <div className="dmsg">{getMessengerThreadPreview(thread)}</div>
            </div>
            <span className="dmode messenger">{SURFACES.messenger.label}</span>
          </div>
        ))}
        {recentThreads.length === 0 && (
          <div className="current-empty">No currents yet. Cast a line.</div>
        )}
      </div>
    </>
  );
}
