import { useNav } from "../../../shared/ui/nav-context";
import type { SurfaceId } from "../../../engine/surfaces";
import "./koi-card.css";

interface KoiCardProps {
  initials: string;
  name: string;
  sub: string;
  mode: SurfaceId;
  active?: boolean;
  online?: boolean;
}

export function KoiCard({
  initials,
  name,
  sub,
  mode,
  active,
  online,
}: KoiCardProps) {
  const nav = useNav();
  const avatarClass = `ava ${mode === "bubbles" ? "k1" : mode === "vn" ? "k2" : "k3"}`;

  function handleClick() {
    nav.setSelectedSurface(mode);
    if (mode === "bubbles")
      nav.setView({ kind: "bubble", threadId: "existing" });
  }

  return (
    <div
      className={`koi-card${active ? " on" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      <div className={avatarClass}>
        {initials}
        <span className={`dot${online !== false ? " live" : " idle"}`} />
      </div>
      <div className="kc-body">
        <div className="kc-name">{name}</div>
        <div className="kc-sub">{sub}</div>
      </div>
      <span className={`kc-mode ${mode}`}>
        {mode === "bubbles" ? "Bubbles" : mode === "vn" ? "VN" : "Reserved"}
      </span>
    </div>
  );
}
