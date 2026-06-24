import { useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useNav } from "../../../shared/ui/nav-context";
import {
  getProviderConnectionById,
  getProviderConnectionStatusLabel,
} from "../../../engine/provider-connection";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from "../../messenger/thread-display";
import "./Waterline.css";

type CatalogPanel = "lore" | "people" | "media" | "connections";
type PeopleTab = "companions" | "personas";

export function Waterline() {
  const nav = useNav();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCatalog, setActiveCatalog] = useState<CatalogPanel | null>(null);
  const [activePeopleTab, setActivePeopleTab] =
    useState<PeopleTab>("companions");
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

  function openCompanion(characterId: string) {
    setActiveCatalog(null);
    nav.setView({ kind: "companions", characterId });
  }

  function openPersona(personaId: string) {
    setActiveCatalog(null);
    nav.setView({ kind: "personas", personaId });
  }

  function openNewPersonRecord() {
    setActiveCatalog(null);

    if (activePeopleTab === "companions") {
      nav.setView({ kind: "companions", mode: "new" });
      return;
    }

    nav.setView({ kind: "personas", mode: "new" });
  }

  function handleCatalogBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setActiveCatalog(null);
  }

  function renderCatalogPanel() {
    if (!activeCatalog) return null;

    if (activeCatalog === "lore") {
      const activeLorebook = nav.lorebooks[0] ?? null;

      return (
        <div className="pebble-panel" role="region" aria-label="Lore library">
          <div className="pebble-panel-head">
            <b>{activeLorebook?.title ?? "Lore library"}</b>
            <span>{activeLorebook?.entries.length ?? 0} entries</span>
          </div>
          <p>
            {activeLorebook?.summary || "No lorebook entries are stocked yet."}
          </p>
          <div className="panel-list">
            {activeLorebook?.entries.map((entry) => (
              <article className="panel-row" key={entry.id}>
                <b>{entry.title}</b>
                <small>{entry.body}</small>
              </article>
            ))}
          </div>
        </div>
      );
    }

    if (activeCatalog === "people") {
      const companionCount = nav.characters.length;
      const personaCount = nav.personas.length;
      const isCompanionsTab = activePeopleTab === "companions";

      return (
        <div
          className="pebble-panel people-panel"
          role="region"
          aria-label="Companions and Personas"
        >
          <div className="pebble-panel-head">
            <b>Companions & Personas</b>
            <span>{companionCount + personaCount} stocked</span>
          </div>
          <div
            className="panel-tabs"
            role="tablist"
            aria-label="Character library"
          >
            <button
              type="button"
              className={`panel-tab${isCompanionsTab ? " on" : ""}`}
              role="tab"
              aria-selected={isCompanionsTab}
              onClick={() => setActivePeopleTab("companions")}
            >
              Companions <span>{companionCount}</span>
            </button>
            <button
              type="button"
              className={`panel-tab${!isCompanionsTab ? " on" : ""}`}
              role="tab"
              aria-selected={!isCompanionsTab}
              onClick={() => setActivePeopleTab("personas")}
            >
              Personas <span>{personaCount}</span>
            </button>
          </div>

          {isCompanionsTab ? (
            companionCount > 0 ? (
              <div className="panel-list people-list">
                {nav.characters.map((companion) => (
                  <button
                    type="button"
                    className="panel-row person-row"
                    key={companion.id}
                    onClick={() => openCompanion(companion.id)}
                  >
                    <span className="panel-avatar">
                      {getMessengerThreadInitials(companion.displayName)}
                    </span>
                    <span className="person-row-copy">
                      <b>{companion.displayName}</b>
                      {companion.shortName && (
                        <em>aka {companion.shortName}</em>
                      )}
                      <small>{companion.summary || "No summary yet."}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="panel-empty">No companions stocked yet.</p>
            )
          ) : personaCount > 0 ? (
            <div className="panel-list people-list">
              {nav.personas.map((persona) => (
                <button
                  type="button"
                  className="panel-row person-row"
                  key={persona.id}
                  onClick={() => openPersona(persona.id)}
                >
                  <span className="panel-avatar persona-avatar">
                    {getMessengerThreadInitials(persona.displayName)}
                  </span>
                  <span className="person-row-copy">
                    <b>{persona.displayName}</b>
                    <small>{persona.summary || "No summary yet."}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="panel-empty">No personas stocked yet.</p>
          )}

          <button
            type="button"
            className="panel-action"
            onClick={openNewPersonRecord}
          >
            {isCompanionsTab ? "New Companion" : "New Persona"}
          </button>
        </div>
      );
    }

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
          className="pebble"
          title="Lore library"
          aria-label="Lore library"
          onClick={() => nav.setView({ kind: "lorebooks" })}
        >
          ▤
        </button>
        <button
          className={`pebble${activeCatalog === "people" ? " on" : ""}`}
          title="Companions and Personas"
          aria-label="Companions and Personas"
          aria-expanded={activeCatalog === "people"}
          onClick={() => toggleCatalog("people")}
        >
          ⚇
        </button>
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
