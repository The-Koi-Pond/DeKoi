import { useMemo, useState } from "react";
import { KoiCard } from "./KoiCard";
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from "../../messenger/thread-display";
import { useNav } from "../../../shared/ui/nav-context";
import "./Shoal.css";

export function Shoal() {
  const nav = useNav();
  const [query, setQuery] = useState("");
  const activeThreadId = nav.view.kind === "messenger" ? nav.view.threadId : null;
  const sortedThreads = useMemo(
    () => sortMessengerThreadsByUpdatedAt(nav.messengerThreads),
    [nav.messengerThreads],
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
    if (!window.confirm(`Release "${title}" from the Shoal?`)) return;
    nav.deleteMessengerThread(threadId);
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
        <span className="sort">↕ Freshest first</span>
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
