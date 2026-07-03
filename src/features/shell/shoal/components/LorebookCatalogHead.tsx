import { FolderIcon } from "./ShoalIcons";

interface LorebookCatalogHeadProps {
  entryCount: number;
  query: string;
  onCreateLorebook: () => void;
  onQueryChange: (query: string) => void;
}

export function LorebookCatalogHead({
  entryCount,
  query,
  onCreateLorebook,
  onQueryChange,
}: LorebookCatalogHeadProps) {
  return (
    <div className="shoal-head">
      <div className="shoal-title">
        <h2>
          <span className="shoal-symbol" aria-hidden="true">
            ▤
          </span>
          Lorebooks
        </h2>
        <span className="count">{entryCount} entries</span>
      </div>
      <div className="shoal-search">
        <label className="glyph" aria-hidden="true" htmlFor="catalog-lorebook-search-input">
          ⌕
        </label>
        <input
          id="catalog-lorebook-search-input"
          type="search"
          placeholder="Find lorebooks or entries..."
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="shoal-actions">
        <button className="pill koi" type="button" onClick={onCreateLorebook}>
          ＋ Lorebook
        </button>
        <button
          className="pill amber title-folder"
          type="button"
          title="Add grouping folder"
          aria-label="Add grouping folder"
          disabled
        >
          <FolderIcon />
          Folder
        </button>
      </div>
    </div>
  );
}
