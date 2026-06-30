import type { PeopleCatalogTab } from "../lib/people-catalog-view-model";
import { FolderIcon } from "./ShoalIcons";

interface PeopleCatalogHeadProps {
  activeTab: PeopleCatalogTab;
  query: string;
  onActiveTabChange: (tab: PeopleCatalogTab) => void;
  onCreate: () => void;
  onQueryChange: (query: string) => void;
}

export function PeopleCatalogHead({
  activeTab,
  query,
  onActiveTabChange,
  onCreate,
  onQueryChange,
}: PeopleCatalogHeadProps) {
  const isCompanionTab = activeTab === "companions";
  const actionTone = isCompanionTab ? "koi" : "roleplay";
  const searchKind = isCompanionTab ? "companions" : "personas";

  return (
    <div className="shoal-head">
      <div
        className="catalog-rail-tabs"
        role="tablist"
        aria-label="Character catalog"
      >
        <button
          type="button"
          className={isCompanionTab ? "on" : ""}
          role="tab"
          aria-selected={isCompanionTab}
          onClick={() => onActiveTabChange("companions")}
        >
          Companions
        </button>
        <button
          type="button"
          className={!isCompanionTab ? "on" : ""}
          role="tab"
          aria-selected={!isCompanionTab}
          onClick={() => onActiveTabChange("personas")}
        >
          Personas
        </button>
      </div>
      <div className="shoal-search">
        <label
          className="glyph"
          aria-hidden="true"
          htmlFor="catalog-people-search-input"
        >
          ⌕
        </label>
        <input
          id="catalog-people-search-input"
          type="search"
          aria-label={`Find ${searchKind}`}
          placeholder={`Find ${searchKind}...`}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="shoal-actions">
        <button className={`pill ${actionTone}`} type="button" onClick={onCreate}>
          ＋ {isCompanionTab ? "Companion" : "Persona"}
        </button>
        <button
          className={`pill ${actionTone} title-folder`}
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
