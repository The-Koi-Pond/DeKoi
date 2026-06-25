import {
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  NavCareActions,
  NavThreadState,
  NavViewActions,
} from "../../navigation";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from "../../modes";
import {
  closeDesktopWindow,
  minimizeDesktopWindow,
  startDesktopWindowDrag,
  toggleDesktopWindowMaximize,
} from "../../../shared/api/window-controls";
import "./Waterline.css";

type WindowControlAction = "close" | "maximize" | "minimize";

interface WaterlineProps {
  nav: WaterlineNav;
}

export type WaterlineNav = Pick<NavCareActions, "setCareOpen"> &
  Pick<NavThreadState, "messengerThreads"> &
  Pick<NavViewActions, "openMessengerThread">;

export function Waterline({ nav }: WaterlineProps) {
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

  const isNoDragTarget = useCallback((target: EventTarget | null) => {
    return target instanceof HTMLElement && !!target.closest("[data-window-no-drag]");
  }, []);

  const startWindowDrag = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (event.button !== 0 || event.detail > 1 || isNoDragTarget(event.target)) {
        return;
      }

      void startDesktopWindowDrag().catch(() => {});
    },
    [isNoDragTarget],
  );

  const toggleMaximizeFromTitlebar = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (isNoDragTarget(event.target)) return;
      void toggleDesktopWindowMaximize().catch(() => {});
    },
    [isNoDragTarget],
  );

  function runWindowControl(action: WindowControlAction) {
    const task =
      action === "minimize"
        ? minimizeDesktopWindow()
        : action === "maximize"
          ? toggleDesktopWindowMaximize()
          : closeDesktopWindow();
    void task.catch(() => {});
  }

  return (
    <header
      className="waterline"
      onMouseDown={startWindowDrag}
      onDoubleClick={toggleMaximizeFromTitlebar}
    >
      <div className="brand">
        <img className="mark" src="/logo.png" alt="" />
      </div>
      <div className="wordmark">DeKoi</div>
      <div
        className={`ripple-search${searchOpen ? " open" : ""}`}
        data-window-no-drag
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
      <div className="pebbles" data-window-no-drag>
        <button
          type="button"
          className="settings-button"
          title="Settings"
          aria-label="Settings"
          onClick={() => nav.setCareOpen(true)}
        >
          <span aria-hidden="true">⚙</span>
          <span>Settings</span>
        </button>
        <div className="window-controls" aria-label="Window controls">
          <button
            type="button"
            className="window-control minimize"
            title="Minimize"
            aria-label="Minimize window"
            onClick={() => runWindowControl("minimize")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 6h8" />
            </svg>
          </button>
          <button
            type="button"
            className="window-control maximize"
            title="Maximize"
            aria-label="Maximize window"
            onClick={() => runWindowControl("maximize")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            type="button"
            className="window-control close"
            title="Close"
            aria-label="Close window"
            onClick={() => runWindowControl("close")}
          >
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6" />
              <path d="M9 3l-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
