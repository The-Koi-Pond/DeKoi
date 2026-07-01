import { useMemo, useState } from "react";
import type { LorebookRecord } from "../../../../engine/contracts/types/lorebook";
import {
  countLorebookCatalogEntries,
  filterLorebookCatalogRecords,
} from "../lib/lorebook-catalog-view-model";

export interface LorebookCatalogRailNav {
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
}

interface UseLorebookCatalogRailControllerInput {
  nav: LorebookCatalogRailNav;
}

export function useLorebookCatalogRailController({
  nav,
}: UseLorebookCatalogRailControllerInput) {
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

  function openLorebook(lorebookId: string) {
    nav.setView({ kind: "lorebooks", lorebookId });
  }

  return {
    activeLorebookId,
    entryCount,
    filteredLorebooks,
    query,
    openLorebook,
    openNewLorebook,
    setQuery,
  };
}
