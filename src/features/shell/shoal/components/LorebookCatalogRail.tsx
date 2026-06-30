import { useMemo, useState } from "react";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import { getMessengerThreadInitials } from "../../../modes";
import { CatalogRailCard } from "./CatalogRailCard";
import { FolderIcon } from "./ShoalIcons";
import { ShoalTopBar } from "./ShoalTopBar";

interface LorebookCatalogRailProps {
  chatSettingsOpen: boolean;
  nav: {
    lorebooks: LorebookRecord[];
    selectedSurface: string;
    setView: (
      view:
        | { kind: "lorebooks"; lorebookId: string }
        | { kind: "lorebooks"; mode: "new-lorebook" },
    ) => void;
    view: {
      kind: string;
      lorebookId?: string;
    };
  };
  onOpenChatSettings: () => void;
  onToggleShoal: () => void;
  shoalClosed: boolean;
}

export function LorebookCatalogRail({
  chatSettingsOpen,
  nav,
  onOpenChatSettings,
  onToggleShoal,
  shoalClosed,
}: LorebookCatalogRailProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const activeLorebookId =
    nav.view.kind === "lorebooks" ? nav.view.lorebookId : null;
  const filteredLorebooks = useMemo(() => {
    if (!normalizedQuery) return nav.lorebooks;

    return nav.lorebooks.filter((lorebook) =>
      [
        lorebook.title,
        lorebook.summary,
        ...lorebook.entries.flatMap((entry) => [entry.title, entry.body]),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [nav.lorebooks, normalizedQuery]);
  const entryCount = nav.lorebooks.reduce(
    (count, lorebook) => count + lorebook.entries.length,
    0,
  );

  return (
    <aside className="shoal catalog-rail" aria-label="Catalog — lorebooks">
      <ShoalTopBar
        chatSettingsOpen={chatSettingsOpen}
        nav={nav}
        onOpenChatSettings={onOpenChatSettings}
        onToggleShoal={onToggleShoal}
        shoalClosed={shoalClosed}
      />
      <div className="shoal-body">
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
            <label
              className="glyph"
              aria-hidden="true"
              htmlFor="catalog-lorebook-search-input"
            >
              ⌕
            </label>
            <input
              id="catalog-lorebook-search-input"
              type="search"
              placeholder="Find lorebooks or entries..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="shoal-actions">
            <button
              className="pill koi"
              type="button"
              onClick={() => nav.setView({ kind: "lorebooks", mode: "new-lorebook" })}
            >
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
        <div className="shoal-list">
          {filteredLorebooks.map((lorebook) => (
            <CatalogRailCard
              key={lorebook.id}
              active={lorebook.id === activeLorebookId}
              initials={getMessengerThreadInitials(lorebook.title)}
              name={lorebook.title}
              sub={lorebook.summary || "No summary yet."}
              tone="amber"
              onOpen={() => nav.setView({ kind: "lorebooks", lorebookId: lorebook.id })}
            />
          ))}
          {filteredLorebooks.length === 0 && (
            <div className="shoal-empty">
              <p>No lorebooks match this search.</p>
              <button
                type="button"
                onClick={() => nav.setView({ kind: "lorebooks", mode: "new-lorebook" })}
              >
                ＋ Lorebook
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
