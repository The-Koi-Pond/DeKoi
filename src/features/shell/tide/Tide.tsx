import './Tide.css'
import type { NavContextType } from '../../navigation'

interface TideProps {
  nav: NavContextType
}

export function Tide({ nav }: TideProps) {
  const surfaceStatus = nav.appSettings.surfaceStatus
  const trimmedSurfaceStatus = surfaceStatus.trim()

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
      <div className="vitals">
        <div className="vital">
          <span className="vl">Clarity</span>
          <div className="bar"><i style={{ width: '88%', background: 'var(--jade)' }} /></div>
          <span className="vp">88%</span>
        </div>
        <div className="vital">
          <span className="vl">Stock</span>
          <div className="bar"><i style={{ width: '100%', background: 'var(--koi)' }} /></div>
          <span className="vp">100%</span>
        </div>
      </div>
    </footer>
  )
}
