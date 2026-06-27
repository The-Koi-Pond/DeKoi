import { useId, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";

interface CatalogSurfaceBannerProps {
  avatarAlt?: string;
  avatarUrl?: string;
  backDisabled?: boolean;
  deleteLabel?: string;
  deleteDisabled?: boolean;
  icon: ReactNode;
  onBack: () => void;
  onAvatarChange?: (avatarUrl: string) => void;
  onDelete?: () => void;
  onSave?: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  saveState?: "clean" | "pending";
  subtitle?: string;
  title: string;
}

function PaintingIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 5.5h15v13h-15z" />
      <path d="m7.5 15 3.2-3.2 2.1 2.1 1.7-1.7 3.9 3.8" />
      <path d="M8.5 8.7h.01" />
    </svg>
  );
}

export function CatalogSurfaceBanner({
  avatarAlt,
  avatarUrl,
  backDisabled = false,
  deleteLabel = "Delete",
  deleteDisabled = false,
  icon,
  onBack,
  onAvatarChange,
  onDelete,
  onSave,
  saveDisabled = false,
  saveLabel = "Save Changes",
  saveState = "clean",
  subtitle,
  title,
}: CatalogSurfaceBannerProps) {
  const avatarInputId = useId();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !file.type.startsWith("image/") || !onAvatarChange) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        onAvatarChange(reader.result);
      }
    });
    reader.readAsDataURL(file);
  }

  function handleAvatarKeyDown(event: KeyboardEvent<HTMLLabelElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    avatarInputRef.current?.click();
  }

  const showProfile = onAvatarChange || avatarUrl || subtitle;

  return (
    <div className="pond-banner catalog-surface-banner">
      <button
        type="button"
        className="back-btn icon-only"
        disabled={backDisabled}
        onClick={onBack}
        aria-label="Back to Pond"
        title="Back to Pond"
      >
        ←
      </button>
      {showProfile ? (
        <div className="catalog-banner-profile">
          {onAvatarChange ? (
            <>
              <label
                className="catalog-banner-avatar editable"
                htmlFor={avatarInputId}
                title="Upload or change image"
                role="button"
                tabIndex={0}
                onKeyDown={handleAvatarKeyDown}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={avatarAlt ?? title} />
                ) : (
                  <PaintingIcon />
                )}
              </label>
              <input
                id={avatarInputId}
                className="catalog-banner-avatar-input"
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
              />
            </>
          ) : (
            <span className="catalog-banner-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={avatarAlt ?? title} />
              ) : (
                <PaintingIcon />
              )}
            </span>
          )}
          <span className="catalog-banner-profile-copy">
            <b>{title}</b>
            {subtitle && <small>{subtitle}</small>}
          </span>
        </div>
      ) : (
        <>
          <span className="ic" aria-hidden="true">
            {icon}
          </span>
          <span>{title}</span>
        </>
      )}
      {onSave && (
        <div className="catalog-banner-actions">
          <button
            type="button"
            className={`catalog-save-btn catalog-save-btn-${saveState}`}
            disabled={saveDisabled}
            onClick={onSave}
          >
            {saveLabel}
          </button>
          {onDelete && (
            <button
              type="button"
              className="catalog-cancel-btn danger"
              disabled={deleteDisabled}
              onClick={onDelete}
            >
              {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
