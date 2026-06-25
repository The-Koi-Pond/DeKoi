import "./Bank.css";

import {
  CLASSIC,
  MESSENGER,
  RESERVED,
  SURFACES,
  type SurfaceId,
} from "../../../engine/surfaces";
import type {
  NavMessengerThreadActions,
  NavViewActions,
  NavViewState,
  SideRailView,
} from "../../navigation";

interface BankProps {
  nav: BankNav;
}

export type BankNav = Pick<
  NavMessengerThreadActions,
  "createMessengerThread"
> &
  Pick<NavViewActions, "setSelectedSurface" | "setSideRailView"> &
  Pick<NavViewState, "selectedSurface" | "sideRailView">;

const DIVES: { mode: SurfaceId; icon: React.ReactNode }[] = [
  {
    mode: MESSENGER,
    icon: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
  },
  {
    mode: CLASSIC,
    icon: (
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 5v14" />
      </>
    ),
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
  },
];

const RAILS: {
  view: Exclude<SideRailView, "shoal">;
  label: string;
  note: string;
  icon: React.ReactNode;
}[] = [
  {
    view: "lorebooks",
    label: "Lorebooks",
    note: "world notes",
    icon: (
      <>
        <path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3-3z" />
        <path d="M5 4v13" />
        <path d="M9 8h5" />
        <path d="M9 11h5" />
      </>
    ),
  },
  {
    view: "people",
    label: "Companions & Personas",
    note: "character catalog",
    icon: (
      <>
        <path d="M8.2 11.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" />
        <path d="M15.8 12.3a2.7 2.7 0 1 0 0-5.4 2.7 2.7 0 0 0 0 5.4z" />
        <path d="M3.8 20a4.7 4.7 0 0 1 8.8-2.3" />
        <path d="M12.8 20a4 4 0 0 1 7.4-2.2" />
      </>
    ),
  },
];

export function Bank({ nav }: BankProps) {
  return (
    <nav className="bank" aria-label="Surface dock">
      <div className="bank-label">The Bank</div>

      {DIVES.map(({ mode, icon }) => {
        const meta = SURFACES[mode];
        const isActive = nav.selectedSurface === mode;
        const locked = meta.locked;

        const className = `dive ${mode}${isActive ? " on" : ""}${locked ? " locked" : ""}`;

        // Locked surfaces are not activatable: render them as non-interactive
        // status chips (aria-disabled, not in the tab order) with a tooltip
        // that explains why. Messenger is a real button.
        if (locked) {
          return (
            <div
              key={mode}
              className={className}
              data-mode={mode}
              role="button"
              aria-disabled="true"
              aria-label={`${meta.label} — ${meta.lockedNote}`}
              title={meta.lockedNote ?? undefined}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                {icon}
              </svg>
              <span className="tag">
                <b>{meta.label}</b>
                <i>{meta.lockedNote}</i>
              </span>
            </div>
          );
        }

        return (
          <div
            key={mode}
            className={className}
            data-mode={mode}
            role="button"
            tabIndex={0}
            aria-label={meta.label}
            aria-pressed={isActive}
            onClick={() => nav.setSelectedSurface(mode)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                nav.setSelectedSurface(mode);
              }
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              {icon}
            </svg>
            <span className="tag">
              <b>{meta.label}</b>
              <i>open water, free talk</i>
            </span>
          </div>
        );
      })}

      <div className="bank-divider" aria-hidden="true" />

      {RAILS.map(({ view, label, note, icon }) => {
        const isActive = nav.sideRailView === view;

        return (
          <button
            key={view}
            type="button"
            className={`rail-tool ${view}${isActive ? " on" : ""}`}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => nav.setSideRailView(view)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              {icon}
            </svg>
            <span className="tag">
              <b>{label}</b>
              <i>{note}</i>
            </span>
          </button>
        );
      })}

      <div className="bank-spacer" />
      <button
        className="cast-fab"
        title="Cast a line — new chat"
        aria-label="Cast a line — new chat"
        onClick={() => {
          nav.setSideRailView("shoal");
          nav.createMessengerThread();
        }}
      >
        +
      </button>
    </nav>
  );
}
