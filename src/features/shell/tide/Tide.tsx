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
  NavRoleplayThreadActions,
  NavCatalogState,
  NavMessengerThreadActions,
  NavSettingsActions,
  NavSettingsState,
  NavThreadState,
  NavViewActions,
  NavViewState,
} from '../../navigation'
import { setRoleplayThreadPersona } from '../../../engine/roleplay-actions'
import { setMessengerThreadPersona } from '../../../engine/messenger-actions'
import {
  getMessengerThreadInitials,
  getMessengerThreadPreview,
  sortMessengerThreadsByUpdatedAt,
} from '../../modes'

interface TideProps {
  nav: TideNav
}

export type TideNav = Pick<NavSettingsActions, 'setSurfaceStatus'> &
  Pick<NavCatalogState, 'personas'> &
  Pick<NavRoleplayThreadActions, 'updateRoleplayThread'> &
  Pick<NavMessengerThreadActions, 'updateMessengerThread'> &
  Pick<NavSettingsState, 'appSettings'> &
  Pick<NavThreadState, 'roleplayThreads' | 'messengerThreads'> &
  Pick<NavViewActions, 'openMessengerThread'> &
  Pick<NavViewState, 'view'>

const ANONYMOUS_PERSONA_LABEL = 'Anonymous'
const ANONYMOUS_PERSONA_INITIALS = 'AN'

function getPersonaInitials(name: string) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return initials || ANONYMOUS_PERSONA_INITIALS
}

export function Tide({ nav }: TideProps) {
  const surfaceStatus = nav.appSettings.surfaceStatus
  const trimmedSurfaceStatus = surfaceStatus.trim()
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false)
  const personaPickerRef = useRef<HTMLDivElement>(null)
  let selectedPersonaId: string | null = null

  if (nav.view.kind === 'messenger') {
    const threadId = nav.view.threadId
    selectedPersonaId =
      nav.messengerThreads.find((thread) => thread.id === threadId)?.activePersonaId ??
      null
  } else if (nav.view.kind === 'roleplay') {
    const threadId = nav.view.threadId
    selectedPersonaId =
      nav.roleplayThreads.find((thread) => thread.id === threadId)?.activePersonaId ??
      null
  } else if (nav.view.kind === 'personas') {
    selectedPersonaId = nav.view.personaId ?? null
  }

  const activePersona = selectedPersonaId
    ? nav.personas.find((persona) => persona.id === selectedPersonaId) ?? null
    : null
  const personaName = activePersona?.displayName ?? ANONYMOUS_PERSONA_LABEL
  const personaInitials = activePersona
    ? getPersonaInitials(activePersona.displayName)
    : ANONYMOUS_PERSONA_INITIALS
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

  useEffect(() => {
    if (!personaMenuOpen) return

    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Node &&
        personaPickerRef.current?.contains(target)
      ) {
        return
      }
      setPersonaMenuOpen(false)
    }

    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') setPersonaMenuOpen(false)
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown)
      document.removeEventListener('keydown', handleDocumentKeyDown)
    }
  }, [personaMenuOpen])

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

  function selectPersona(personaId: string | null) {
    const now = new Date().toISOString()

    if (nav.view.kind === 'messenger') {
      const threadId = nav.view.threadId
      const thread =
        nav.messengerThreads.find((candidate) => candidate.id === threadId) ?? null
      if (thread) {
        nav.updateMessengerThread(
          setMessengerThreadPersona(thread, personaId, now),
        )
      }
    } else if (nav.view.kind === 'roleplay') {
      const threadId = nav.view.threadId
      const thread =
        nav.roleplayThreads.find((candidate) => candidate.id === threadId) ?? null
      if (thread) {
        nav.updateRoleplayThread(setRoleplayThreadPersona(thread, personaId, now))
      }
    }

    setPersonaMenuOpen(false)
  }

  function togglePersonaMenu() {
    setPersonaMenuOpen((currentOpen) => !currentOpen)
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
      <div className="user-presence" ref={personaPickerRef}>
        <button
          type="button"
          className="persona-avatar"
          aria-controls="tide-persona-menu"
          aria-expanded={personaMenuOpen}
          aria-haspopup="menu"
          aria-label="Switch persona"
          title="Switch persona"
          onClick={togglePersonaMenu}
        >
          {activePersona?.avatarUrl ? (
            <img src={activePersona.avatarUrl} alt="" />
          ) : (
            personaInitials
          )}
          <span className="presence-dot" />
        </button>
        <span className="presence-copy">
          <span className="persona-name" title={personaName}>
            {personaName}
          </span>
          <span className="presence-status">
            Online
            {trimmedSurfaceStatus && (
              <span className="surface-status" title={trimmedSurfaceStatus}>
                {trimmedSurfaceStatus}
              </span>
            )}
          </span>
        </span>
        {personaMenuOpen && (
          <div
            className="persona-menu"
            id="tide-persona-menu"
            role="menu"
            aria-label="Choose persona"
          >
            <button
              type="button"
              className={`persona-option${!activePersona ? ' selected' : ''}`}
              role="menuitemradio"
              aria-checked={!activePersona}
              onClick={() => selectPersona(null)}
            >
              <span className="persona-option-avatar" aria-hidden="true">
                {ANONYMOUS_PERSONA_INITIALS}
              </span>
              <span className="persona-option-copy">
                <span>{ANONYMOUS_PERSONA_LABEL}</span>
                <small>No persona selected</small>
              </span>
            </button>
            {nav.personas.map((persona) => (
              <button
                type="button"
                className={`persona-option${
                  activePersona?.id === persona.id ? ' selected' : ''
                }`}
                key={persona.id}
                role="menuitemradio"
                aria-checked={activePersona?.id === persona.id}
                onClick={() => selectPersona(persona.id)}
              >
                <span className="persona-option-avatar" aria-hidden="true">
                  {persona.avatarUrl ? (
                    <img src={persona.avatarUrl} alt="" />
                  ) : (
                    getPersonaInitials(persona.displayName)
                  )}
                </span>
                <span className="persona-option-copy">
                  <span>{persona.displayName}</span>
                  <small>{persona.nickname || persona.personality || 'Persona'}</small>
                </span>
              </button>
            ))}
          </div>
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
