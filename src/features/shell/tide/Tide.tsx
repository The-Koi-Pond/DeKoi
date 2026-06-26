import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import './Tide.css'
import type {
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
} from '../../navigation'
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from '../../modes'

interface TideProps {
  nav: TideNav
}

export type TideNav = Pick<NavSettingsActions, 'setSurfaceStatus'> &
  Pick<NavSettingsState, 'appSettings'> &
  Pick<NavThreadState, 'messengerThreads'> &
  Pick<NavViewActions, 'openMessengerThread'>

export function Tide({ nav }: TideProps) {
  const surfaceStatus = nav.appSettings.surfaceStatus
  const trimmedSurfaceStatus = surfaceStatus.trim()
  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const threadResults = useMemo(() => {
    if (!normalizedQuery) return []

    return sortMessengerThreadsByUpdatedAt(nav.messengerThreads)
      .filter((thread) => {
        const preview = getMessengerThreadPreview(thread)
        return (
          thread.title.toLowerCase().includes(normalizedQuery) ||
          preview.toLowerCase().includes(normalizedQuery)
        )
      })
      .slice(0, 5)
  }, [nav.messengerThreads, normalizedQuery])
  const resultsOpen = searchExpanded && normalizedQuery.length > 0

  useEffect(() => {
    if (searchExpanded) searchInputRef.current?.focus()
  }, [searchExpanded])

  function toggleSearch() {
    if (searchExpanded) {
      setQuery('')
      setSearchExpanded(false)
      return
    }

    setSearchExpanded(true)
  }

  function clearSearch() {
    setQuery('')
    searchInputRef.current?.focus()
  }

  function openThread(threadId: string) {
    nav.openMessengerThread(threadId)
    setQuery('')
    setSearchExpanded(false)
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (query) {
        clearSearch()
        return
      }
      setSearchExpanded(false)
      return
    }

    if (event.key === 'Enter' && threadResults[0]) {
      event.preventDefault()
      openThread(threadResults[0].id)
    }
  }

  function handleSearchBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    if (!normalizedQuery) setSearchExpanded(false)
  }

  return (
    <footer className="tide">
      <div className="swim-state">
        <span className="pulse" />
        <span>Swimming</span>
        {trimmedSurfaceStatus && (
          <span className="surface-status" title={trimmedSurfaceStatus}>
            {trimmedSurfaceStatus}
          </span>
        )}
      </div>
      <div className="surface-input">
        <input
          aria-label="Set your surface status"
          maxLength={80}
          placeholder="Set your surface — what are you up to?"
          value={surfaceStatus}
          onChange={(event) => nav.setSurfaceStatus(event.target.value)}
        />
        {surfaceStatus && (
          <button
            type="button"
            aria-label="Clear surface status"
            title="Clear"
            onClick={() => nav.setSurfaceStatus('')}
          >
            ×
          </button>
        )}
      </div>
      <div
        className={`thread-search${searchExpanded ? ' expanded' : ''}`}
        onBlur={handleSearchBlur}
      >
        <button
          type="button"
          className="thread-search-toggle"
          aria-controls="tide-thread-search"
          aria-expanded={searchExpanded}
          aria-label={
            searchExpanded ? 'Collapse Messenger search' : 'Search Messenger threads'
          }
          title="Search Messenger threads"
          onClick={toggleSearch}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
        </button>
        {searchExpanded && (
          <>
            <input
              ref={searchInputRef}
              id="tide-thread-search"
              aria-controls="tide-search-results"
              aria-expanded={resultsOpen}
              aria-label="Search Messenger threads"
              autoComplete="off"
              placeholder="Search Messenger threads..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {query && (
              <button
                type="button"
                className="thread-search-clear"
                aria-label="Clear search"
                title="Clear"
                onClick={clearSearch}
              >
                ×
              </button>
            )}
          </>
        )}
        {resultsOpen && (
          <div
            className="thread-search-results"
            id="tide-search-results"
            role="listbox"
            aria-label="Search results"
          >
            {threadResults.map((thread) => (
              <button
                type="button"
                className="thread-search-result"
                key={thread.id}
                role="option"
                onClick={() => openThread(thread.id)}
              >
                <span className="thread-search-avatar">
                  {getMessengerThreadInitials(thread.title)}
                </span>
                <span className="thread-search-copy">
                  <span>{thread.title}</span>
                  <small>{getMessengerThreadPreview(thread)}</small>
                </span>
              </button>
            ))}
            {threadResults.length === 0 && (
              <div className="thread-search-empty" role="status">
                No Messenger threads found.
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  )
}
