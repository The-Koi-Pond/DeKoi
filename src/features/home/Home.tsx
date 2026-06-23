import { BUBBLES_SURFACE_LABEL, POND_SURFACE_LABEL, type BubbleMessage } from '../../engine/bubbles'
import { COMPANION_SURFACE_LABEL } from '../../engine/character'
import { LOREBOOK_SURFACE_LABEL } from '../../engine/lorebook'
import { PERSONA_SURFACE_LABEL } from '../../engine/persona'
import { RIPPLE_DOCK_SURFACE_LABEL, RIPPLES_SURFACE_LABEL } from '../../engine/ripples'
import {
  sampleBubbleThread,
  sampleCompanions,
  sampleLorebook,
  samplePersona,
  sampleRippleState,
} from '../../engine/sample-bubbles'

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

export function Home() {
  const participantSummary = sampleCompanions.map((companion) => companion.displayName).join(' + ')
  const latestMessage = sampleBubbleThread.messages[sampleBubbleThread.messages.length - 1]

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
            <button type="button" disabled>
              New thread
            </button>
          </div>

          <article className="thread-row active" aria-label={sampleBubbleThread.title}>
            <div className="thread-avatar">{getInitials(sampleBubbleThread.title)}</div>
            <div className="thread-copy">
              <div className="thread-line">
                <h3>{sampleBubbleThread.title}</h3>
                <span>{sampleBubbleThread.messages.length}</span>
              </div>
              <p>{latestMessage.body}</p>
              <small>Group Bubble with {participantSummary}</small>
            </div>
          </article>
        </aside>

        <section className="bubble-surface" aria-labelledby="bubble-thread-title">
          <header className="bubble-header">
            <div>
              <p className="eyebrow">{BUBBLES_SURFACE_LABEL}</p>
              <h2 id="bubble-thread-title">{sampleBubbleThread.title}</h2>
              <p className="thread-meta">Group Bubble with {participantSummary}</p>
            </div>
            <div className="participant-stack" aria-label="Thread participants">
              <span title={samplePersona.displayName}>{getInitials(samplePersona.displayName)}</span>
              {sampleCompanions.map((companion) => (
                <span title={companion.displayName} key={companion.id}>
                  {getInitials(companion.displayName)}
                </span>
              ))}
            </div>
          </header>

          <div className="message-list" aria-label="Bubble messages">
            {sampleBubbleThread.messages.map((message) => (
              <article className={getMessageClassName(message)} key={message.id}>
                <div className="message-author">{message.author.label}</div>
                <p>{message.body}</p>
              </article>
            ))}
          </div>

          <form className="bubble-composer" aria-label="Bubble composer">
            <textarea aria-label="Draft Bubble message" placeholder="Write a Bubble..." readOnly />
            <button type="button" disabled>
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
