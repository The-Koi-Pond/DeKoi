import { useMemo, useState, type KeyboardEvent } from "react";
import { RESERVED } from "../../../../engine/surfaces";
import type {
  NavCareActions,
  NavClassicThreadActions,
  NavMessengerThreadActions,
  NavThreadState,
  NavViewActions,
} from "../../../navigation";
import {
  sortClassicThreadsByUpdatedAt,
  sortMessengerThreadsByUpdatedAt,
} from "../../../modes";
import "./depths.css";

type FeatureDepth = "Shallows" | "Deep" | "Murky" | "Surfacing soon";
type FeatureSurface =
  | "Messenger"
  | "Classic"
  | "Lore library"
  | "Companions"
  | "Media"
  | "Settings"
  | "Deep water"
  | "Help";

interface FeatureResult {
  id: string;
  label: string;
  description: string;
  surface: FeatureSurface;
  depth: FeatureDepth;
  action: "messenger" | "care" | "classic" | "reserved" | "none";
}

interface DepthsProps {
  nav: DepthsNav;
}

export type DepthsNav = Pick<
  NavCareActions,
  "setCareOpen" | "setCareTab"
> &
  Pick<NavClassicThreadActions, "createClassicThread"> &
  Pick<NavMessengerThreadActions, "createMessengerThread"> &
  Pick<NavThreadState, "classicThreads" | "messengerThreads"> &
  Pick<
    NavViewActions,
    "openClassicThread" | "openMessengerThread" | "setSelectedSurface"
  >;

const surfaceChips: Array<"All surfaces" | FeatureSurface> = [
  "All surfaces",
  "Messenger",
  "Classic",
  "Lore library",
  "Companions",
  "Media",
  "Settings",
  "Deep water",
  "Help",
];

const depthChips: Array<"All depths" | FeatureDepth> = [
  "All depths",
  "Shallows",
  "Deep",
  "Murky",
  "Surfacing soon",
];

const featureResults: FeatureResult[] = [
  {
    id: "new-messenger-thread",
    label: "Start a Messenger thread",
    description: "Cast a line and open the first active DM-style surface.",
    surface: "Messenger",
    depth: "Shallows",
    action: "messenger",
  },
  {
    id: "find-saved-threads",
    label: "Find saved Messenger threads",
    description: "Use the Shoal or Waterline search to reopen a saved thread.",
    surface: "Messenger",
    depth: "Shallows",
    action: "messenger",
  },
  {
    id: "lore-library",
    label: "Review lorebook entries",
    description: "Read the stocked First Pond lore and native-record notes.",
    surface: "Lore library",
    depth: "Shallows",
    action: "none",
  },
  {
    id: "companions",
    label: "Check stocked Companions",
    description: "View the sample cast currently available to Messenger.",
    surface: "Companions",
    depth: "Shallows",
    action: "none",
  },
  {
    id: "remote-runtime",
    label: "Configure remote runtime",
    description: "Point future profile and save data at a remote runtime host.",
    surface: "Settings",
    depth: "Deep",
    action: "care",
  },
  {
    id: "classic-scenes",
    label: "Classic scene surface",
    description: "Create or reopen a saved visual-novel-style scene.",
    surface: "Classic",
    depth: "Shallows",
    action: "classic",
  },
  {
    id: "media-library",
    label: "Media library",
    description: "Sprites, backgrounds, audio, and generated assets.",
    surface: "Media",
    depth: "Surfacing soon",
    action: "none",
  },
  {
    id: "deep-water",
    label: "Deep Water settings",
    description: "Advanced profile, save data, and storage controls.",
    surface: "Deep water",
    depth: "Murky",
    action: "care",
  },
  {
    id: "reserved-surface",
    label: "Reserved surface",
    description: "A placeholder for a not-yet-decided future surface.",
    surface: "Deep water",
    depth: "Surfacing soon",
    action: "reserved",
  },
];

function matchesQuery(result: FeatureResult, query: string) {
  if (!query) return true;
  const haystack = `${result.label} ${result.description} ${result.surface} ${result.depth}`.toLowerCase();
  return haystack.includes(query);
}

export function Depths({ nav }: DepthsProps) {
  const [surfaceIdx, setSurfaceIdx] = useState(0);
  const [depthIdx, setDepthIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const selectedSurface = surfaceChips[surfaceIdx];
  const selectedDepth = depthChips[depthIdx];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredResults = useMemo(
    () =>
      featureResults.filter(
        (result) =>
          matchesQuery(result, normalizedQuery) &&
          (selectedSurface === "All surfaces" || result.surface === selectedSurface) &&
          (selectedDepth === "All depths" || result.depth === selectedDepth),
      ),
    [normalizedQuery, selectedDepth, selectedSurface],
  );
  const visibleResults = showAll ? filteredResults : filteredResults.slice(0, 3);

  function openLatestMessengerThread() {
    const latestThread = sortMessengerThreadsByUpdatedAt(nav.messengerThreads)[0];
    if (latestThread) {
      nav.openMessengerThread(latestThread.id);
      return;
    }

    nav.createMessengerThread();
  }

  function openLatestClassicThread() {
    const latestThread = sortClassicThreadsByUpdatedAt(nav.classicThreads)[0];
    if (latestThread) {
      nav.openClassicThread(latestThread.id);
      return;
    }

    nav.createClassicThread();
  }

  function activateResult(result: FeatureResult) {
    if (result.action === "messenger") {
      openLatestMessengerThread();
      return;
    }

    if (result.action === "care") {
      nav.setCareTab(4);
      nav.setCareOpen(true);
      return;
    }

    if (result.action === "classic") {
      openLatestClassicThread();
      return;
    }

    if (result.action === "reserved") {
      nav.setSelectedSurface(RESERVED);
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
      return;
    }

    if (event.key === "Enter" && visibleResults[0]) {
      event.preventDefault();
      activateResult(visibleResults[0]);
    }
  }

  return (
    <div className="depths">
      <div className="depths-top">
        <div className="dic" aria-hidden="true">
          ◉
        </div>
        <div>
          <h4>Sound the depths</h4>
          <p>Search DeKoi by what you want to do, then dive to the surface that owns it.</p>
        </div>
      </div>
      <div className="depths-search">
        <span className="glyph" aria-hidden="true">
          ⌕
        </span>
        <input
          aria-label="Search DeKoi features"
          placeholder="Search features — e.g. lore, storage, companions..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      <div className="chips" id="surfaceChips" aria-label="Feature surface filter">
        {surfaceChips.map((chip, i) => (
          <button
            type="button"
            key={chip}
            className={`chip${surfaceIdx === i ? " on" : ""}`}
            aria-pressed={surfaceIdx === i}
            onClick={() => setSurfaceIdx(i)}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="chips depth" id="depthChips" aria-label="Feature depth filter">
        {depthChips.map((chip, i) => (
          <button
            type="button"
            key={chip}
            className={`chip${depthIdx === i ? " on" : ""}`}
            aria-pressed={depthIdx === i}
            onClick={() => setDepthIdx(i)}
          >
            {chip}
          </button>
        ))}
      </div>
      <div className="pop-results" aria-live="polite">
        {visibleResults.map((result) => (
          <button
            type="button"
            className="pop"
            key={result.id}
            onClick={() => activateResult(result)}
          >
            <span className="pop-main">
              <span className="pop-q">{result.label}</span>
              <span className="pop-desc">{result.description}</span>
            </span>
            <span className="pop-to">→ {result.surface}</span>
          </button>
        ))}
        {visibleResults.length === 0 && (
          <div className="pop empty">No stocked features match those filters.</div>
        )}
      </div>
      <div className="depths-foot">
        <div className="stock">
          <span style={{ color: "var(--jade)" }} aria-hidden="true">
            ◌
          </span>{" "}
          <b>{filteredResults.length}</b> of {featureResults.length} features match
        </div>
        <button
          className="browse-all"
          type="button"
          disabled={filteredResults.length <= 3}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? "⌃ Show fewer" : `⌄ Wade through all ${filteredResults.length}`}
        </button>
      </div>
    </div>
  );
}
