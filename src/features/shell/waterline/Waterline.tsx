import { useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useNav } from "../../../shared/ui/nav-context";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from "../../messenger/thread-display";
import "./Waterline.css";

export function Waterline() {
  const nav = useNav();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
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
      <div className="pebbles">
        <button
          className="pebble on"
          title="Lore library"
          aria-label="Lore library"
        >
          ▤
        </button>
        <button className="pebble" title="Companions" aria-label="Companions">
          ⚇
        </button>
        <button className="pebble" title="Media" aria-label="Media">
          ◐
        </button>
        <button className="pebble" title="Connections" aria-label="Connections">
          ⌗
        </button>
        <button
          className="pebble care"
          title="Pond Care"
          aria-label="Pond Care"
          onClick={() => nav.setCareOpen(true)}
        >
          ⚙
        </button>
        <div className="win-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </header>
  );
}
