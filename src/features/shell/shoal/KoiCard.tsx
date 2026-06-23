import { useNav } from "../../../shared/ui/nav-context";
import { SURFACES, type SurfaceId } from "../../../engine/surfaces";
import "./koi-card.css";

interface KoiCardProps {
  initials: string;
  name: string;
  sub: string;
  mode: SurfaceId;
  active?: boolean;
  online?: boolean;
}

// Avatar gradient per surface. Locked surfaces keep their color but render as
// non-navigable status rows.
const AVA_VARIANT: Record<SurfaceId, string> = {
  bubbles: "k1",
  vn: "k2",
  reserved: "k3",
};

export function KoiCard({
  initials,
  name,
  sub,
  mode,
  active,
  online,
}: KoiCardProps) {
  const nav = useNav();
  const meta = SURFACES[mode];
  const locked = meta.locked;

  function handleClick() {
    if (locked) return;
    nav.setSelectedSurface(mode);
    nav.setView({ kind: "bubble", threadId: "first-pond" });
  }

  return (
    <div
      className={`koi-card${active ? " on" : ""}${locked ? " locked" : ""}`}
      role="button"
      tabIndex={locked ? -1 : 0}
      aria-disabled={locked || undefined}
      aria-label={`${name} — ${meta.label}${locked ? ` (${meta.lockedNote})` : ""}`}
      title={locked ? (meta.lockedNote ?? undefined) : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (locked) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className={`ava ${AVA_VARIANT[mode]}`}>
        {initials}
        <span className={`dot${online !== false ? " live" : " idle"}`} />
      </div>
      <div className="kc-body">
        <div className="kc-name">{name}</div>
        <div className="kc-sub">{sub}</div>
      </div>
      <span className={`kc-mode ${mode}`}>{meta.label}</span>
    </div>
  );
}
