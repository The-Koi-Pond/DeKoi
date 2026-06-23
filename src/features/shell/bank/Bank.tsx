import "./Bank.css";

import { useNav } from "../../../shared/ui/nav-context";
import { BUBBLES, VN, RESERVED } from "../../../engine/surfaces";

export function Bank() {
  const nav = useNav();
  return (
    <nav className="bank">
      <div className="bank-label">The Bank</div>

      <div
        className={`dive bubbles${nav.selectedSurface === BUBBLES ? " on" : ""}`}
        data-mode="bubbles"
        role="button"
        tabIndex={0}
        aria-label="Bubbles mode"
        onClick={() => nav.setSelectedSurface(BUBBLES)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />
        </svg>
        <span className="tag">
          <b>Bubbles</b>
          <i>open water, free talk</i>
        </span>
      </div>
      <div
        className={`dive vn${nav.selectedSurface === VN ? " on" : ""}`}
        data-mode="vn"
        role="button"
        tabIndex={0}
        aria-label="VN mode — locked"
        aria-disabled="true"
        title="Surfacing soon"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
          <path d="M4 5v14" />
        </svg>
        <span className="tag">
          <b>VN</b>
          <i>swim into a story</i>
        </span>
      </div>
      <div
        className={`dive reserved${nav.selectedSurface === RESERVED ? " on" : ""}`}
        data-mode="reserved"
        role="button"
        tabIndex={0}
        aria-label="Reserved mode — locked"
        aria-disabled="true"
        title="Deep water — not yet available"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M6 3v6a6 6 0 0 0 12 0V3" />
          <path d="M6 21h12" />
          <path d="M12 15v6" />
        </svg>
        <span className="tag">
          <b>Reserved</b>
          <i>cast into the depths</i>
        </span>
      </div>

      <div className="bank-spacer" />
      <button
        className="cast-fab"
        title="Cast a line — new chat"
        aria-label="Cast a line — new chat"
        onClick={() => nav.setView({ kind: "bubble", threadId: "new" })}
      >
        +
      </button>
      <div className="me" title="Your koi" aria-label="Your koi profile">
        M
      </div>
    </nav>
  );
}
