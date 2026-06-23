import "./Bank.css";

import { useNav } from "../../../shared/ui/nav-context";
import {
  BUBBLES,
  VN,
  RESERVED,
  SURFACES,
  type SurfaceId,
} from "../../../engine/surfaces";

const DIVES: { mode: SurfaceId; icon: React.ReactNode }[] = [
  {
    mode: BUBBLES,
    icon: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
  },
  {
    mode: VN,
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

export function Bank() {
  const nav = useNav();

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
        // that explains why. Bubbles is a real button.
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

      <div className="bank-spacer" />
      <button
        className="cast-fab"
        title="Cast a line — new chat"
        aria-label="Cast a line — new chat"
        onClick={() => nav.setView({ kind: "bubble", threadId: "first-pond" })}
      >
        +
      </button>
      <div className="me" title="Your koi" aria-label="Your koi profile">
        M
      </div>
    </nav>
  );
}
