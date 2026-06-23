import type { NavContextType } from "../../../shared/ui/nav-context";
import type { SurfaceId } from "../../../engine/surfaces";
import { BUBBLES, VN, RESERVED } from "../../../engine/surfaces";
import "./pools.css";

interface ModePoolsProps {
  nav: NavContextType;
}

const pools: {
  mode: SurfaceId;
  icon: string;
  title: string;
  desc: string;
  meta: string;
}[] = [
  {
    mode: BUBBLES,
    icon: "M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z",
    title: "Bubbles",
    desc: "Open water. Talk freely with the AI, no scene, no rules.",
    meta: "12 koi · last dived 2h ago",
  },
  {
    mode: VN,
    icon: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 5v14",
    title: "VN",
    desc: "Swim into a story. Characters, lore, and scenes carry the current.",
    meta: "8 koi · 35m ago",
  },
  {
    mode: RESERVED,
    icon: "M6 3v6a6 6 0 0 0 12 0V3 M6 21h12 M12 15v6",
    title: "Reserved",
    desc: "Cast into the depths. Turn-based play, narration, and systems.",
    meta: "5 koi · yesterday",
  },
];

export function ModePools({ nav }: ModePoolsProps) {
  return (
    <div className="pools">
      {pools.map((pool) => (
        <div
          key={pool.mode}
          className={`pool ${pool.mode}${nav.selectedSurface === pool.mode ? " on" : ""}`}
          data-mode={pool.mode}
          onClick={() => {
            if (pool.mode === BUBBLES) {
              nav.setSelectedSurface(pool.mode);
              nav.setView({ kind: "bubble", threadId: "new" });
            }
          }}
          aria-disabled={pool.mode !== BUBBLES || undefined}
        >
          <div className="shimmer" />
          <div className="pool-ic">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden="true"
            >
              <path d={pool.icon} />
            </svg>
          </div>
          <h3>{pool.title}</h3>
          <p>{pool.desc}</p>
          <div className="pool-meta">{pool.meta}</div>
          <div className="go">Dive in →</div>
        </div>
      ))}
    </div>
  );
}
