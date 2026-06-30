import { FolderIcon } from "./ShoalIcons";

interface ConnectionsCatalogHeadProps {
  onCreateConnection: () => void;
}

export function ConnectionsCatalogHead({
  onCreateConnection,
}: ConnectionsCatalogHeadProps) {
  return (
    <div className="shoal-head">
      <div className="shoal-title">
        <h2>
          <span className="shoal-symbol" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M10.2 13.8a4.2 4.2 0 0 0 5.9 0l2-2a4.2 4.2 0 0 0-5.9-5.9l-1.1 1.1" />
              <path d="M13.8 10.2a4.2 4.2 0 0 0-5.9 0l-2 2a4.2 4.2 0 0 0 5.9 5.9l1.1-1.1" />
            </svg>
          </span>
          Connections
        </h2>
      </div>
      <div className="shoal-actions">
        <button className="pill koi" type="button" onClick={onCreateConnection}>
          ＋ Connection
        </button>
        <button
          className="pill koi title-folder"
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
