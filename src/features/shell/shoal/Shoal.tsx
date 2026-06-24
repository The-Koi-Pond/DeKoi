import { useMemo, useState } from "react";
import { KoiCard } from "./KoiCard";
import {
  getClassicThreadInitials,
  getClassicThreadPreview,
  sortClassicThreads,
} from "../../classic/classic-display";
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
  const activeClassicThreadId =
    nav.view.kind === "classic" ? nav.view.threadId : null;
  const sortedThreads = useMemo(
    () => sortMessengerThreads(nav.messengerThreads, sortMode),
    [nav.messengerThreads, sortMode],
  );
  const sortedClassicThreads = useMemo(
    () => sortClassicThreads(nav.classicThreads, sortMode),
    [nav.classicThreads, sortMode],
  );
  const totalThreads = sortedThreads.length + sortedClassicThreads.length;
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
  const filteredClassicThreads = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sortedClassicThreads;

    return sortedClassicThreads.filter((thread) => {
      const preview = getClassicThreadPreview(thread);
      return (
        thread.title.toLowerCase().includes(normalizedQuery) ||
        preview.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [query, sortedClassicThreads]);

  function handleRenameMessenger(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Messenger thread", currentTitle);
    if (nextTitle === null) return;
    nav.renameMessengerThread(threadId, nextTitle);
  }

  function handleRenameClassic(threadId: string, currentTitle: string) {
    const nextTitle = window.prompt("Rename Classic scene", currentTitle);
    if (nextTitle === null) return;
    nav.renameClassicThread(threadId, nextTitle);
  }

  function handleDeleteMessenger(threadId: string, title: string) {
    if (
      nav.appSettings.confirmRelease &&
      !window.confirm(`Release "${title}" from the Shoal?`)
    ) {
      return;
    }

    nav.deleteMessengerThread(threadId);
  }

  function handleDeleteClassic(threadId: string, title: string) {
    if (
      nav.appSettings.confirmRelease &&
      !window.confirm(`Release "${title}" from the Shoal?`)
    ) {
      return;
    }

    nav.deleteClassicThread(threadId);
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
          <span className="count">{totalThreads} swimming</span>
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
          <button className="pill" onClick={() => nav.createClassicThread()}>
            ＋ Scene
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
          ⌗ {filteredThreads.length + filteredClassicThreads.length} shown
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
            onRename={() => handleRenameMessenger(thread.id, thread.title)}
            onDelete={() => handleDeleteMessenger(thread.id, thread.title)}
          />
        ))}
        <div className="group-label">Classic — saved locally</div>
        {filteredClassicThreads.map((thread) => (
          <KoiCard
            key={thread.id}
            initials={getClassicThreadInitials(thread.title)}
            name={thread.title}
            sub={getClassicThreadPreview(thread)}
            mode="classic"
            active={thread.id === activeClassicThreadId}
            online
            onOpen={() => nav.openClassicThread(thread.id)}
            onRename={() => handleRenameClassic(thread.id, thread.title)}
            onDelete={() => handleDeleteClassic(thread.id, thread.title)}
          />
        ))}
        {filteredThreads.length === 0 && filteredClassicThreads.length === 0 && (
          <div className="shoal-empty">
            <p>No saved currents match this search.</p>
            <button type="button" onClick={() => nav.createMessengerThread()}>
              Cast a line
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
