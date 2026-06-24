import { useMemo, useState } from "react";
import { KoiCard } from "./KoiCard";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreads,
} from "../../messenger/thread-display";
import { useNav } from "../../../shared/ui/nav-context";
import type { ShoalSortMode } from "../../../runtime/app-settings";
import "./Shoal.css";

const SHOAL_SORT_ORDER: ShoalSortMode[] = ["freshest", "oldest", "title"];
const SHOAL_SORT_LABELS: Record<ShoalSortMode, string> = {
  freshest: "Freshest first",
  oldest: "Oldest first",
  title: "A-Z",
};

export function Shoal() {
  const nav = useNav();
  const [query, setQuery] = useState("");
  const sortMode = nav.appSettings.shoalSortMode;
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const sortedThreads = useMemo(
    () => sortMessengerThreads(nav.messengerThreads, sortMode),
    [nav.messengerThreads, sortMode],
  );
  const storageLabel =
    nav.messengerStorageMode === "remote" && nav.messengerStorageStatus !== "error"
      ? "remote runtime"
      : "saved locally";
  const filteredThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedThreads;

    return sortedThreads.filter((thread) => {
      const preview = getMessengerThreadPreview(thread);
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedThreads]);

  function handleRename(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Messenger thread", currentTitle);
    if (nextTitle === null) return;
    nav.renameMessengerThread(threadId, nextTitle);
  }

  function handleDelete(threadId: string, title: string) {
    if (
      nav.appSettings.confirmRelease &&
      !window.confirm(`Release "${title}" from the Shoal?`)
    ) {
      return;
    }

    nav.deleteMessengerThread(threadId);
  }

  function cycleSortMode() {
    const currentIndex = SHOAL_SORT_ORDER.indexOf(sortMode);
    const nextIndex =
      currentIndex === -1 ? 0 : (currentIndex + 1) % SHOAL_SORT_ORDER.length;
    nav.setShoalSortMode(SHOAL_SORT_ORDER[nextIndex]);
  }

  return (
    <aside className="shoal" aria-label="The Shoal — saved threads">
      <div className="shoal-head">
        <div className="shoal-title">
          <h2>
            <img className="shoal-mark" src="/koi-mark.svg" alt="" />
            The Shoal
          </h2>
          <span className="count">{sortedThreads.length} swimming</span>
        </div>
        <div className="shoal-search">
          <label
            className="glyph"
            aria-hidden="true"
            htmlFor="shoal-search-input"
          >
            ⌕
          </label>
          <input
            id="shoal-search-input"
            type="search"
            placeholder="Find a koi by name or marking…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="shoal-actions">
          <button
            className="pill koi"
            onClick={() => nav.createMessengerThread()}
          >
            ＋ Cast a line
          </button>
          <button className="pill" disabled title="Not stocked yet">
            ⬡ Net
          </button>
          <button className="pill" disabled title="Not stocked yet">
            ◇ Catch
          </button>
        </div>
      </div>
      <div className="shoal-meta">
        <button
          type="button"
          className="sort"
          aria-label={`Sort Messenger threads: ${SHOAL_SORT_LABELS[sortMode]}`}
          title="Change thread sort"
          onClick={cycleSortMode}
        >
          ↕ {SHOAL_SORT_LABELS[sortMode]}
        </button>
        <span className="mark-chip" title={nav.messengerStorageMessage}>
          ⌗ {filteredThreads.length} shown
        </span>
      </div>
      <div className="shoal-list">
        <div className="group-label">Messenger — {storageLabel}</div>
        {filteredThreads.map((thread) => (
          <KoiCard
            key={thread.id}
            initials={getMessengerThreadInitials(thread.title)}
            name={thread.title}
            sub={getMessengerThreadPreview(thread)}
            mode="messenger"
            active={thread.id === activeThreadId}
            online
            onOpen={() => nav.openMessengerThread(thread.id)}
            onRename={() => handleRename(thread.id, thread.title)}
            onDelete={() => handleDelete(thread.id, thread.title)}
          />
        ))}
        {filteredThreads.length === 0 && (
          <div className="shoal-empty">
            <p>No Messenger threads match this search.</p>
            <button type="button" onClick={() => nav.createMessengerThread()}>
              Cast a line
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
