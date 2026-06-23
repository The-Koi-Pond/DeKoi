import { countTracksByStatus, projectTracks } from '../../engine/project-plan'

const statusLabels = {
  ready: 'Ready',
  next: 'Next',
  blocked: 'Blocked',
} as const

export function Home() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="dekoi-title">
        <img className="hero-mark" src="/mark.svg" alt="" />
        <div className="hero-copy">
          <p className="eyebrow">Fresh local seed</p>
          <h1 id="dekoi-title">DeKoi</h1>
          <p className="lede">
            A clean starting point for a private, local-first story and character engine with its own
            code, contracts, and identity.
          </p>
        </div>
      </section>

      <section className="status-strip" aria-label="Project status">
        <div>
          <span>{countTracksByStatus('ready')}</span>
          <p>Ready tracks</p>
        </div>
        <div>
          <span>{countTracksByStatus('next')}</span>
          <p>Next track</p>
        </div>
        <div>
          <span>{countTracksByStatus('blocked')}</span>
          <p>Held back</p>
        </div>
      </section>

      <section className="track-grid" aria-label="Clean rebuild tracks">
        {projectTracks.map((track) => (
          <article className="track-card" key={track.id}>
            <div className="track-card-header">
              <h2>{track.title}</h2>
              <span data-status={track.status}>{statusLabels[track.status]}</span>
            </div>
            <p>{track.summary}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
