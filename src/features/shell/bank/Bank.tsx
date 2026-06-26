import "./Bank.css";

import {
  CLASSIC,
  MESSENGER,
  RESERVED,
  SURFACES,
  type SurfaceId,
} from "../../../engine/surfaces";
import type {
  NavViewActions,
  NavViewState,
  SideRailView,
} from "../../navigation";

interface BankProps {
  nav: BankNav;
  onOpenShoal: () => void;
  shoalClosed: boolean;
}

export type BankNav = Pick<NavViewActions, "setSelectedSurface" | "setSideRailView"> &
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
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  },
  {
    mode: RESERVED,
    icon: (
      <path d="M20.2 5.8a5.1 5.1 0 0 0-7.2 0L12 6.8l-1-1a5.1 5.1 0 0 0-7.2 7.2l1 1L12 21l7.2-7 1-1a5.1 5.1 0 0 0 0-7.2z" />
    ),
  },
];

const RAILS: {
  view: Exclude<SideRailView, "shoal" | "connections">;
  label: string;
  note: string;
  icon: React.ReactNode;
}[] = [
  {
    view: "people",
    label: "Companions / Personas",
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
  {
    view: "lorebooks",
    label: "Lorebooks",
    note: "world notes",
    icon: (
      <>
        <path d="M4 5.5h6a3 3 0 0 1 3 3v11a3 3 0 0 0-3-2.5H4z" />
        <path d="M20 5.5h-6a3 3 0 0 0-3 3v11a3 3 0 0 1 3-2.5h6z" />
        <path d="M8 9h2" />
        <path d="M16 9h-2" />
      </>
    ),
  },
  {
    view: "media",
    label: "Media",
    note: "assets library",
    icon: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="2" />
        <path d="M8 13l2.2-2.2 3 3L15 12l3 3" />
        <path d="M8.5 8.5h.01" />
      </>
    ),
  },
  {
    view: "presets",
    label: "Presets",
    note: "saved setups",
    icon: (
      <>
        <path d="M5 5h14" />
        <path d="M5 12h14" />
        <path d="M5 19h14" />
        <path d="M8 3v4" />
        <path d="M16 10v4" />
        <path d="M11 17v4" />
      </>
    ),
  },
];

export function Bank({ nav, onOpenShoal, shoalClosed }: BankProps) {
  return (
    <nav className="bank" aria-label="Surface dock">
      <div className="bank-label">The Bank</div>
      {shoalClosed && (
        <button
          type="button"
          className="shoal-reopen"
          aria-label="Open The Shoal"
          onClick={onOpenShoal}
        >
          ›
        </button>
      )}

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
            onClick={() => {
              onOpenShoal();
              nav.setSelectedSurface(mode);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenShoal();
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
            aria-label={label}
            aria-pressed={isActive}
            onClick={() => {
              onOpenShoal();
              nav.setSideRailView(view);
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
              <b>{label}</b>
              <i>{note}</i>
            </span>
          </button>
        );
      })}

      <div className="bank-divider" aria-hidden="true" />

      <button
        type="button"
        className={`rail-tool connections${
          nav.sideRailView === "connections" ? " on" : ""
        }`}
        aria-label="Connections"
        aria-pressed={nav.sideRailView === "connections"}
        onClick={() => {
          onOpenShoal();
          nav.setSideRailView("connections");
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M10.2 13.8a4.2 4.2 0 0 0 5.9 0l2-2a4.2 4.2 0 0 0-5.9-5.9l-1.1 1.1" />
          <path d="M13.8 10.2a4.2 4.2 0 0 0-5.9 0l-2 2a4.2 4.2 0 0 0 5.9 5.9l1.1-1.1" />
        </svg>
        <span className="tag">
          <b>Connections</b>
          <i>provider settings</i>
        </span>
      </button>
      <div className="bank-spacer" />
    </nav>
  );
}
