import type {
  NavRoleplayThreadActions,
  NavMessengerThreadActions,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from "../../../navigation";
import {
  ROLEPLAY,
  MESSENGER,
  RESERVED,
  SURFACES,
  type SurfaceId,
} from "../../../../engine/contracts/constants/surfaces";
import { sortRoleplayThreadsByUpdatedAt, sortMessengerThreadsByUpdatedAt } from "../../../modes";
import "./pools.css";

interface ModePoolsProps {
  nav: ModePoolsNav;
}

export type ModePoolsNav = Pick<NavRoleplayThreadActions, "createRoleplayThread"> &
  Pick<NavMessengerThreadActions, "createMessengerThread"> &
  Pick<NavThreadState, "modeThreads"> &
  Pick<NavViewActions, "openRoleplayThread" | "openMessengerThread" | "setSelectedSurface"> &
  Pick<NavViewState, "selectedSurface">;

const POOLS: {
  mode: SurfaceId;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    mode: MESSENGER,
    icon: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
    desc: "Open water. Talk freely with the AI, no scene, no rules.",
  },
  {
    mode: ROLEPLAY,
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
    desc: "Swim into a story. Characters, lore, and scenes carry the current.",
  },
  {
    mode: RESERVED,
    icon: (
      <path d="M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 0 0-7.2 7.2l1 1L12 21l7.2-7 1-1a5.1 5.1 0 0 0 0-7.2z" />
    ),
    desc: "Cast into the depths. Turn-based play, narration, and systems.",
  },
];

export function ModePools({ nav }: ModePoolsProps) {
  function openLatestMessengerThread() {
    const latestThread = sortMessengerThreadsByUpdatedAt(
      nav.modeThreads.filter((thread) => thread.kind === "messenger"),
    )[0];
    if (latestThread) {
      nav.openMessengerThread(latestThread.id);
      return;
    }

    nav.createMessengerThread();
  }

  function openLatestRoleplayThread() {
    const latestThread = sortRoleplayThreadsByUpdatedAt(
      nav.modeThreads.filter((thread) => thread.kind === "roleplay"),
    )[0];
    if (latestThread) {
      nav.openRoleplayThread(latestThread.id);
      return;
    }

    nav.createRoleplayThread();
  }

  function openPool(mode: SurfaceId) {
    nav.setSelectedSurface(mode);
    if (mode === MESSENGER) {
      openLatestMessengerThread();
      return;
    }

    if (mode === ROLEPLAY) {
      openLatestRoleplayThread();
    }
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
          </div>
        );
      })}
    </div>
  );
}
