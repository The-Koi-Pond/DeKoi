import { FolderIcon } from "./ShoalIcons";

interface ThreadShoalHeadProps {
  activeSurfaceLabel: string;
  isRoleplaySurface: boolean;
  newMessengerOpen: boolean;
  newRoleplayOpen: boolean;
  query: string;
  searchPlaceholder: string;
  sortLabel: string;
  onCreateActiveThread: () => void;
  onCycleSortMode: () => void;
  onQueryChange: (query: string) => void;
}

export function ThreadShoalHead({
  activeSurfaceLabel,
  isRoleplaySurface,
  newMessengerOpen,
  newRoleplayOpen,
  query,
  searchPlaceholder,
  sortLabel,
  onCreateActiveThread,
  onCycleSortMode,
  onQueryChange,
}: ThreadShoalHeadProps) {
  return (
    <>
      <div className="shoal-surface-title">{activeSurfaceLabel}</div>
      <div className="shoal-head">
        <div className="shoal-title">
          <button
            className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-cast`}
            type="button"
            aria-controls={
              isRoleplaySurface
                ? "new-roleplay-thread-popover"
                : "new-messenger-thread-popover"
            }
            aria-expanded={isRoleplaySurface ? newRoleplayOpen : newMessengerOpen}
            onClick={onCreateActiveThread}
          >
            {isRoleplaySurface ? "+ New Roleplay" : "+ Cast a Line"}
          </button>
          <button
            className={`pill ${isRoleplaySurface ? "roleplay" : "koi"} title-folder`}
            type="button"
            title="Add grouping folder"
            aria-label="Add grouping folder"
            disabled
          >
            <FolderIcon />
            Folder
          </button>
        </div>
        <div className="shoal-search">
          <label className="glyph" aria-hidden="true" htmlFor="shoal-search-input">
            ⌕
          </label>
          <input
            id="shoal-search-input"
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
      <div className="shoal-meta">
        <button
          type="button"
          className="sort"
          aria-label={`Sort ${activeSurfaceLabel} threads: ${sortLabel}`}
          title="Change thread sort"
          onClick={onCycleSortMode}
        >
          ↕ {sortLabel}
        </button>
      </div>
    </>
  );
}
