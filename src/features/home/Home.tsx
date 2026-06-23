import { useEffect, useRef, useState, type FormEvent } from 'react'
import { BUBBLES_SURFACE_LABEL, POND_SURFACE_LABEL, type BubbleMessage } from '../../engine/bubbles'
import {
  appendBubbleMessages,
  createPersonaBubbleMessage,
  createPlaceholderCompanionMessage,
  getNextPlaceholderCompanion,
  getPlaceholderReplyText,
} from '../../engine/bubble-actions'
import { COMPANION_SURFACE_LABEL } from '../../engine/character'
import { LOREBOOK_SURFACE_LABEL } from '../../engine/lorebook'
import { PERSONA_SURFACE_LABEL } from '../../engine/persona'
import { RIPPLE_DOCK_SURFACE_LABEL, RIPPLES_SURFACE_LABEL } from '../../engine/ripples'
import {
  sampleCompanions,
  sampleLorebook,
  samplePersona,
  sampleRippleState,
} from '../../engine/sample-bubbles'
import { loadBubbleThread, resetBubbleThreadStorage, saveBubbleThread } from '../../runtime/bubble-local-storage'

const surfaceLabels = [
  BUBBLES_SURFACE_LABEL,
  'VN',
  COMPANION_SURFACE_LABEL,
  PERSONA_SURFACE_LABEL,
  LOREBOOK_SURFACE_LABEL,
] as const

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function getMessageClassName(message: BubbleMessage) {
  return message.author.kind === 'persona' ? 'bubble-message bubble-message-own' : 'bubble-message'
}

function createLocalId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function Home() {
  const [bubbleThread, setBubbleThread] = useState(loadBubbleThread)
  const [draft, setDraft] = useState('')
  const messageListRef = useRef<HTMLDivElement>(null)
  const participantSummary = sampleCompanions.map((companion) => companion.displayName).join(' + ')
  const latestMessage = bubbleThread.messages[bubbleThread.messages.length - 1]
  const canSend = draft.trim().length > 0

  useEffect(() => {
    saveBubbleThread(bubbleThread)
  }, [bubbleThread])

  useEffect(() => {
    if (!messageListRef.current) return
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight
  }, [bubbleThread.messages.length])

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedDraft = draft.trim()
    if (!trimmedDraft) return

    const sentAt = new Date().toISOString()
    const userMessage = createPersonaBubbleMessage({
      body: trimmedDraft,
      id: createLocalId('bubble-message'),
      now: sentAt,
      persona: samplePersona,
      thread: bubbleThread,
    })
    const threadWithUserMessage = appendBubbleMessages(bubbleThread, [userMessage], sentAt)
    const placeholderCompanion = getNextPlaceholderCompanion(threadWithUserMessage, sampleCompanions)

    if (!placeholderCompanion) {
      setBubbleThread(threadWithUserMessage)
      setDraft('')
      return
    }

    const repliedAt = new Date().toISOString()
    const placeholderReply = createPlaceholderCompanionMessage({
      body: getPlaceholderReplyText(trimmedDraft),
      companion: placeholderCompanion,
      id: createLocalId('bubble-message'),
      now: repliedAt,
      thread: threadWithUserMessage,
    })

    setBubbleThread(appendBubbleMessages(threadWithUserMessage, [placeholderReply], repliedAt))
    setDraft('')
  }

  function handleResetThread() {
    setBubbleThread(resetBubbleThreadStorage())
    setDraft('')
  }

  return (
    <main className="app-shell">
      <header className="top-shell">
        <div className="brand-lockup">
          <img className="brand-mark" src="/mark.svg" alt="" />
          <div>
            <p className="eyebrow">{POND_SURFACE_LABEL}</p>
            <h1>DeKoi</h1>
          </div>
        </div>

        <nav className="surface-tabs" aria-label="Primary surfaces">
          {surfaceLabels.map((label) => (
            <span className={label === BUBBLES_SURFACE_LABEL ? 'surface-tab active' : 'surface-tab'} key={label}>
              {label}
            </span>
          ))}
        </nav>
      </header>

      <section className="workspace-grid" aria-label="DeKoi workspace preview">
        <aside className="pond-rail" aria-label={`${POND_SURFACE_LABEL} threads`}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{POND_SURFACE_LABEL}</p>
              <h2>Threads</h2>
            </div>
            <div className="panel-actions">
              <button type="button" className="secondary-button" onClick={handleResetThread}>
                Reset
              </button>
              <button type="button" disabled>
                New
              </button>
            </div>
          </div>

          <article className="thread-row active" aria-label={bubbleThread.title}>
            <div className="thread-avatar">{getInitials(bubbleThread.title)}</div>
            <div className="thread-copy">
              <div className="thread-line">
                <h3>{bubbleThread.title}</h3>
                <span>{bubbleThread.messages.length}</span>
              </div>
              <p>{latestMessage?.body ?? 'No messages yet.'}</p>
              <small>Group Bubble with {participantSummary}</small>
            </div>
          </article>
        </aside>

        <section className="bubble-surface" aria-labelledby="bubble-thread-title">
          <header className="bubble-header">
            <div>
              <p className="eyebrow">{BUBBLES_SURFACE_LABEL}</p>
              <h2 id="bubble-thread-title">{bubbleThread.title}</h2>
              <p className="thread-meta">Group Bubble with {participantSummary}</p>
            </div>
            <div className="bubble-header-tools">
              <span className="storage-chip">Saved locally</span>
              <div className="participant-stack" aria-label="Thread participants">
                <span title={samplePersona.displayName}>{getInitials(samplePersona.displayName)}</span>
                {sampleCompanions.map((companion) => (
                  <span title={companion.displayName} key={companion.id}>
                    {getInitials(companion.displayName)}
                  </span>
                ))}
              </div>
            </div>
          </header>

          <div className="message-list" aria-label="Bubble messages" ref={messageListRef}>
            {bubbleThread.messages.map((message) => (
              <article className={getMessageClassName(message)} key={message.id}>
                <div className="message-author">
                  {message.author.label}
                  {message.origin === 'placeholder' && <span>Placeholder</span>}
                </div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>

          <form className="bubble-composer" aria-label="Bubble composer" onSubmit={handleSend}>
            <textarea
              aria-label="Draft Bubble message"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a Bubble..."
              value={draft}
            />
            <button type="submit" disabled={!canSend}>
              Send
            </button>
          </form>
        </section>

        <aside className="context-rail" aria-label="Thread context">
          <section className="side-panel" aria-labelledby="companions-title">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Library</p>
                <h2 id="companions-title">{COMPANION_SURFACE_LABEL}</h2>
              </div>
            </div>

            <div className="companion-list">
              {sampleCompanions.map((companion) => (
                <article className="companion-row" key={companion.id}>
                  <div className="mini-avatar">{getInitials(companion.displayName)}</div>
                  <div>
                    <h3>{companion.displayName}</h3>
                    <p>{companion.summary}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="side-panel" aria-labelledby="lorebook-title">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">{LOREBOOK_SURFACE_LABEL}</p>
                <h2 id="lorebook-title">{sampleLorebook.title}</h2>
              </div>
              <span className="count-pill">{sampleLorebook.entries.length}</span>
            </div>
            <div className="note-list">
              {sampleLorebook.entries.map((entry) => (
                <article className="note-row" key={entry.id}>
                  <h3>{entry.title}</h3>
                  <p>{entry.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="side-panel" aria-labelledby="ripple-title">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">{RIPPLES_SURFACE_LABEL}</p>
                <h2 id="ripple-title">{RIPPLE_DOCK_SURFACE_LABEL}</h2>
              </div>
            </div>
            <div className="note-list">
              {sampleRippleState.ripples.map((ripple) => (
                <article className="note-row" data-tone={ripple.tone} key={ripple.id}>
                  <h3>{ripple.title}</h3>
                  <p>{ripple.body}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  )
}
