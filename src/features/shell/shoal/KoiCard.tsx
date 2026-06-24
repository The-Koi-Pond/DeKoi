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
  onDelete?: () => void;
  onOpen?: () => void;
  onRename?: () => void;
}

// Avatar gradient per surface. Locked surfaces keep their color but render as
// non-navigable status rows.
const AVA_VARIANT: Record<SurfaceId, string> = {
  messenger: "k1",
  classic: "k2",
  reserved: "k3",
};

export function KoiCard({
  initials,
  name,
  sub,
  mode,
  active,
  online,
  onDelete,
  onOpen,
  onRename,
}: KoiCardProps) {
  const nav = useNav();
  const meta = SURFACES[mode];
  const locked = meta.locked;

  function handleClick() {
    if (locked) return;
    if (onOpen) {
      onOpen();
      return;
    }

    nav.setSelectedSurface(mode);
    nav.createMessengerThread();
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
        if (e.target !== e.currentTarget) return;
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
      {(onRename || onDelete) && (
        <div className="kc-actions" aria-label={`${name} actions`}>
          {onRename && (
            <button
              type="button"
              aria-label={`Rename ${name}`}
              title="Rename"
              onClick={(event) => {
                event.stopPropagation();
                onRename();
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              aria-label={`Release ${name}`}
              title="Release"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
