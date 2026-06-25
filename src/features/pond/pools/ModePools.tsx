import type { NavContextType } from "../../navigation/nav-types";
import {
  CLASSIC,
  MESSENGER,
  RESERVED,
  SURFACES,
  type SurfaceId,
} from "../../../engine/surfaces";
import { sortClassicThreadsByUpdatedAt } from "../../classic/classic-display";
import { sortMessengerThreadsByUpdatedAt } from "../../messenger/thread-display";
import "./pools.css";

interface ModePoolsProps {
  nav: NavContextType;
}

const POOLS: {
  mode: SurfaceId;
  icon: React.ReactNode;
  desc: string;
  meta: string;
}[] = [
  {
    mode: MESSENGER,
    icon: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
    desc: "Open water. Talk freely with the AI, no scene, no rules.",
    meta: "saved threads",
  },
  {
    mode: CLASSIC,
    icon: (
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 5v14" />
      </>
    ),
    desc: "Swim into a story. Characters, lore, and scenes carry the current.",
    meta: "saved scenes",
  },
  {
    mode: RESERVED,
    icon: (
      <>
        <path d="M6 3v6a6 6 0 0 0 12 0V3" />
        <path d="M6 21h12" />
        <path d="M12 15v6" />
      </>
    ),
    desc: "Cast into the depths. Turn-based play, narration, and systems.",
    meta: "5 koi · yesterday",
  },
];

export function ModePools({ nav }: ModePoolsProps) {
  function openLatestMessengerThread() {
    const latestThread = sortMessengerThreadsByUpdatedAt(nav.messengerThreads)[0];
    if (latestThread) {
      nav.openMessengerThread(latestThread.id);
      return;
    }

    nav.createMessengerThread();
  }

  function openLatestClassicThread() {
    const latestThread = sortClassicThreadsByUpdatedAt(nav.classicThreads)[0];
    if (latestThread) {
      nav.openClassicThread(latestThread.id);
      return;
    }

    nav.createClassicThread();
  }

  function openPool(mode: SurfaceId) {
    nav.setSelectedSurface(mode);
    if (mode === MESSENGER) {
      openLatestMessengerThread();
      return;
    }

    if (mode === CLASSIC) {
      openLatestClassicThread();
    }
  }

  function getPoolMeta(mode: SurfaceId, fallback: string) {
    if (mode === MESSENGER) return `${nav.messengerThreads.length} threads`;
    if (mode === CLASSIC) return `${nav.classicThreads.length} scenes`;
    return fallback;
  }

  return (
    <div className="pools">
      {POOLS.map((pool) => {
        const meta = SURFACES[pool.mode];
        const locked = meta.locked;
        const active = nav.selectedSurface === pool.mode;
        const className = `pool ${pool.mode}${active ? " on" : ""}${locked ? " locked" : ""}`;

        return (
          <div
            key={pool.mode}
            className={className}
            data-mode={pool.mode}
            role="button"
            tabIndex={locked ? -1 : 0}
            aria-disabled={locked || undefined}
            aria-label={`${meta.label}${locked ? ` — ${meta.lockedNote}` : ""}`}
            title={locked ? (meta.lockedNote ?? undefined) : undefined}
            onClick={() => {
              if (locked) return;
              openPool(pool.mode);
            }}
            onKeyDown={(e) => {
              if (locked) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openPool(pool.mode);
              }
            }}
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
                {pool.icon}
              </svg>
            </div>
            <h3>{meta.label}</h3>
            <p>{pool.desc}</p>
            <div className="pool-meta">{getPoolMeta(pool.mode, pool.meta)}</div>
            <div className="go">{locked ? meta.lockedNote : "Dive in →"}</div>
          </div>
        );
      })}
    </div>
  );
}
