import { useNav } from "../../../shared/ui/nav-context";
import "./Waterline.css";

export function Waterline() {
  const nav = useNav();
  return (
    <header className="waterline">
      <div className="brand">
        <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
          <use href="#koi-mark" style={{ color: "var(--koi)" }} />
        </svg>
      </div>
      <div className="wordmark">De-Koi</div>
      <div className="ripple-search">
        <span className="glyph" aria-hidden="true">
          ⌕
        </span>
        <input placeholder="Search the pond — chats, lore, agents, features…" />
      </div>
      <div className="pebbles">
        <button
          className="pebble on"
          title="Lore library"
          aria-label="Lore library"
        >
          ▤
        </button>
        <button className="pebble" title="Companions" aria-label="Companions">
          ⚇
        </button>
        <button className="pebble" title="Media" aria-label="Media">
          ◐
        </button>
        <button className="pebble" title="Connections" aria-label="Connections">
          ⌗
        </button>
        <button
          className="pebble care"
          title="Pond Care"
          aria-label="Pond Care"
          onClick={() => nav.setCareOpen(true)}
        >
          ⚙
        </button>
        <div className="win-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </header>
  );
}
