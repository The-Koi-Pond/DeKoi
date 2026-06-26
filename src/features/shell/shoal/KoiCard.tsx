import type { ReactNode } from "react";
import { SURFACES, type SurfaceId } from "../../../engine/surfaces";
import "./koi-card.css";

interface KoiCardProps {
  avatarLabel?: string;
  avatarUrl?: string | null;
  icon?: ReactNode;
  initials: string;
  name: string;
  sub: string;
  mode: SurfaceId;
  active?: boolean;
  online?: boolean;
  onDelete?: () => void;
  onOpen: () => void;
  onRename?: () => void;
  showStatus?: boolean;
}

// Avatar gradient per surface. Locked surfaces keep their color but render as
// non-navigable status rows.
const AVA_VARIANT: Record<SurfaceId, string> = {
  messenger: "k1",
  classic: "k2",
  reserved: "k3",
};

export function KoiCard({
  avatarLabel,
  avatarUrl,
  icon,
  initials,
  name,
  sub,
  mode,
  active,
  online,
  onDelete,
  onOpen,
  onRename,
  showStatus = true,
}: KoiCardProps) {
  const meta = SURFACES[mode];
  const locked = meta.locked;

  function handleClick() {
    if (locked) return;
    onOpen();
  }

  return (
    <div
      className={`koi-card${active ? " on" : ""}${locked ? " locked" : ""}${onRename || onDelete ? " actionable" : ""}`}
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
        {avatarUrl ? (
          <img src={avatarUrl} alt={avatarLabel ?? ""} />
        ) : icon ? (
          <span className="ava-icon" aria-hidden="true">
            {icon}
          </span>
        ) : (
          initials
        )}
        {showStatus && (
          <span className={`dot${online !== false ? " live" : " idle"}`} />
        )}
      </div>
      <div className="kc-body">
        <div className="kc-name">{name}</div>
        <div className="kc-sub">{sub}</div>
      </div>
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
