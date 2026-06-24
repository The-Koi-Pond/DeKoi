import { SURFACES } from "../../../engine/surfaces";
import { useNav } from "../../../shared/ui/nav-context";
import {
  getBubbleThreadInitials,
  getBubbleThreadPreview,
  getBubbleThreadTimeLabel,
  sortBubbleThreadsByUpdatedAt,
} from "../../bubbles/thread-display";
import "./currents.css";

export function RecentCurrents() {
  const nav = useNav();
  const recentThreads = sortBubbleThreadsByUpdatedAt(nav.bubbleThreads).slice(
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
            onClick={() => nav.openBubbleThread(thread.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                nav.openBubbleThread(thread.id);
              }
            }}
          >
            <div
              className="da"
              style={{
                background: "linear-gradient(140deg,#f6a15a,#e06a2b)",
              }}
            >
              {getBubbleThreadInitials(thread.title)}
            </div>
            <div className="db">
              <div className="dt">
                <span className="dn">{thread.title}</span>
                <span className="dtime">
                  {getBubbleThreadTimeLabel(thread.updatedAt)}
                </span>
              </div>
              <div className="dmsg">{getBubbleThreadPreview(thread)}</div>
            </div>
            <span className="dmode bubbles">{SURFACES.bubbles.label}</span>
          </div>
        ))}
        {recentThreads.length === 0 && (
          <div className="current-empty">No currents yet. Cast a line.</div>
        )}
      </div>
    </>
  );
}
