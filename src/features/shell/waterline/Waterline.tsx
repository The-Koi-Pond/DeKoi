import { useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import type { NavContextType } from "../../navigation";
import {
  getProviderConnectionById,
  getProviderConnectionStatusLabel,
} from "../../../engine/provider-connection";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from "../../modes";
import "./Waterline.css";

type CatalogPanel = "media" | "connections";

interface WaterlineProps {
  nav: NavContextType;
}

export function Waterline({ nav }: WaterlineProps) {
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<CatalogPanel | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const activeConnection = getProviderConnectionById(
    nav.appSettings.activeMessengerConnectionId,
    nav.providerConnections,
  );
  const threadResults = useMemo(() => {
    if (!normalizedQuery) return [];

    return sortMessengerThreadsByUpdatedAt(nav.messengerThreads)
      .filter((thread) => {
        const preview = getMessengerThreadPreview(thread);
        return (
          thread.title.toLowerCase().includes(normalizedQuery) ||
          preview.toLowerCase().includes(normalizedQuery)
        );
      })
      .slice(0, 5);
  }, [nav.messengerThreads, normalizedQuery]);
  const searchOpen = searchFocused && normalizedQuery.length > 0;

  function clearSearch() {
    setQuery("");
  }

  function openThread(threadId: string) {
    nav.openMessengerThread(threadId);
    clearSearch();
    setSearchFocused(false);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
      return;
    }

    if (event.key === "Enter" && threadResults[0]) {
      event.preventDefault();
      openThread(threadResults[0].id);
    }
  }

  function handleSearchBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setSearchFocused(false);
  }

  function toggleCatalog(panel: CatalogPanel) {
    setActiveCatalog((currentPanel) => (currentPanel === panel ? null : panel));
  }

  function handleCatalogBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setActiveCatalog(null);
  }

  function renderCatalogPanel() {
    if (!activeCatalog) return null;

    if (activeCatalog === "connections") {
      return (
        <div className="pebble-panel" role="region" aria-label="Connections">
          <div className="pebble-panel-head">
            <b>Connections</b>
            <span>{nav.providerConnections.length} stocked</span>
          </div>
          <p>New Messenger threads use {activeConnection.label}.</p>
          <div className="panel-list">
            {nav.providerConnections.map((connection) => {
              const selected =
                connection.id === nav.appSettings.activeMessengerConnectionId;

              return (
                <button
                  type="button"
                  className={`panel-row connection-row${
                    selected ? " selected" : ""
                  }`}
                  aria-pressed={selected}
                  key={connection.id}
                  onClick={() =>
                    nav.setActiveMessengerConnectionId(connection.id)
                  }
                >
                  <span className="connection-copy">
                    <b>{connection.label}</b>
                    <small>{connection.summary}</small>
                  </span>
                  <span className="connection-status">
                    {getProviderConnectionStatusLabel(connection.status)}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="panel-action"
            onClick={() => {
              setActiveCatalog(null);
              nav.setCareOpen(true);
            }}
          >
            Open Pond Care
          </button>
        </div>
      );
    }

    return (
      <div className="pebble-panel" role="region" aria-label="Media">
        <div className="pebble-panel-head">
          <b>Media</b>
          <span>empty</span>
        </div>
        <p>
          Sprites, backgrounds, audio, and generated assets will surface here
          once the media library is stocked.
        </p>
      </div>
    );
  }

  return (
    <header className="waterline">
      <div className="brand">
        <img className="mark" src="/logo.png" alt="" />
      </div>
      <div className="wordmark">DeKoi</div>
      <div
        className={`ripple-search${searchOpen ? " open" : ""}`}
        onBlur={handleSearchBlur}
      >
        <span className="glyph" aria-hidden="true">
          ⌕
        </span>
        <input
          aria-controls="waterline-search-results"
          aria-expanded={searchOpen}
          aria-label="Search Messenger threads"
          autoComplete="off"
          placeholder="Search Messenger threads..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setSearchFocused(true)}
          onKeyDown={handleSearchKeyDown}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            ×
          </button>
        )}
        {searchOpen && (
          <div
            className="search-results"
            id="waterline-search-results"
            role="listbox"
            aria-label="Search results"
          >
            {threadResults.map((thread) => (
              <button
                type="button"
                className="search-result"
                key={thread.id}
                role="option"
                onClick={() => openThread(thread.id)}
              >
                <span className="search-avatar">
                  {getMessengerThreadInitials(thread.title)}
                </span>
                <span className="search-copy">
                  <span>{thread.title}</span>
                  <small>{getMessengerThreadPreview(thread)}</small>
                </span>
              </button>
            ))}
            {threadResults.length === 0 && (
              <div className="search-empty" role="status">
                No Messenger threads found.
              </div>
            )}
          </div>
        )}
      </div>
      <div className="pebbles" onBlur={handleCatalogBlur}>
        <button
          className={`pebble${activeCatalog === "media" ? " on" : ""}`}
          title="Media"
          aria-label="Media"
          aria-expanded={activeCatalog === "media"}
          onClick={() => toggleCatalog("media")}
        >
          ◐
        </button>
        <button
          className={`pebble${activeCatalog === "connections" ? " on" : ""}`}
          title="Connections"
          aria-label="Connections"
          aria-expanded={activeCatalog === "connections"}
          onClick={() => toggleCatalog("connections")}
        >
          ⌗
        </button>
        <button
          className="pebble care"
          title="Pond Care"
          aria-label="Pond Care"
          onClick={() => {
            setActiveCatalog(null);
            nav.setCareOpen(true);
          }}
        >
          ⚙
        </button>
        <div className="win-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        {renderCatalogPanel()}
      </div>
    </header>
  );
}
