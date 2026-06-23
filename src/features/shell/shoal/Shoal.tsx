import { KoiCard } from "./KoiCard";
import "./Shoal.css";

export function Shoal() {
  return (
    <aside className="shoal">
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              style={{ color: "var(--jade)" }}
              aria-hidden="true"
            >
              <use href="#fish" />
            </svg>{" "}
            The Shoal
          </h2>
          <span className="count">5 swimming</span>
        </div>
        <div className="shoal-search">
          <span className="glyph" aria-hidden="true">
            ⌕
          </span>
          <input placeholder="Find a koi by name or marking…" />
        </div>
        <div className="shoal-actions">
          <button className="pill koi">＋ Cast a line</button>
          <button className="pill">⬡ Net</button>
          <button className="pill">◇ Catch</button>
        </div>
      </div>
      <div className="shoal-meta">
        <span className="sort">↕ Freshest first</span>
        <span className="mark-chip">⌗ 1 marking</span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Surface — active today</div>
        <KoiCard
          initials="M"
          name="Professor Mari"
          sub="…and the tide pool experiment begins"
          mode="bubbles"
          active
          online
        />
        <KoiCard
          initials="A"
          name="Azur"
          sub="The storm hasn't passed yet…"
          mode="vn"
          online
        />
        <div className="group-label">Deeper — earlier</div>
        <KoiCard
          initials="A"
          name="Azur — VN"
          sub="A second current, branching off"
          mode="vn"
        />
        <KoiCard
          initials="K"
          name="Kingfisher Keep"
          sub="Turn 14 · party rests by the weir"
          mode="reserved"
        />
        <KoiCard
          initials="S"
          name="Sable"
          sub="The grove remembers everything"
          mode="vn"
        />
      </div>
    </aside>
  );
}
