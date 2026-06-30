import { useMemo, useState } from "react";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import {
  countLorebookCatalogEntries,
  filterLorebookCatalogRecords,
} from "../lib/lorebook-catalog-view-model";
import { LorebookCatalogHead } from "./LorebookCatalogHead";
import { LorebookCatalogList } from "./LorebookCatalogList";
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
    nav.view.kind === "lorebooks" ? nav.view.lorebookId ?? null : null;
  const filteredLorebooks = useMemo(
    () => filterLorebookCatalogRecords(nav.lorebooks, normalizedQuery),
    [nav.lorebooks, normalizedQuery],
  );
  const entryCount = useMemo(
    () => countLorebookCatalogEntries(nav.lorebooks),
    [nav.lorebooks],
  );

  function openNewLorebook() {
    nav.setView({ kind: "lorebooks", mode: "new-lorebook" });
  }

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
        <LorebookCatalogHead
          entryCount={entryCount}
          query={query}
          onCreateLorebook={openNewLorebook}
          onQueryChange={setQuery}
        />
        <LorebookCatalogList
          activeLorebookId={activeLorebookId}
          lorebooks={filteredLorebooks}
          onCreateLorebook={openNewLorebook}
          onOpenLorebook={(lorebookId) =>
            nav.setView({ kind: "lorebooks", lorebookId })
          }
        />
      </div>
    </aside>
  );
}
