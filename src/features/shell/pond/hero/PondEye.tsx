/** Animated koi orbit art — ported from design/pond-mockup.html lines 749–783 */
import './PondEye.css'

export function PondEye() {
  return (
    <div className="pond-eye">
      <div className="ring" />
      <div className="ring r2" />
      <div className="ring r3" />
      <div className="ripple-ping" style={{ animationDelay: '0s' }} />
      <div className="ripple-ping" style={{ animationDelay: '-2.2s' }} />

      {/* outer orbit: 3 orange koi, clockwise */}
      <div className="orbit" style={{ '--T': '26s' } as React.CSSProperties}>
        <div className="koi-wrap" style={{ '--R': '78px', '--still-angle': '30deg', animationDelay: '0s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="30" height="17" viewBox="0 0 32 18" style={{ color: 'var(--koi)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
        <div className="koi-wrap" style={{ '--R': '78px', '--still-angle': '150deg', animationDelay: '-8.6s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="26" height="15" viewBox="0 0 32 18" style={{ color: 'var(--koi)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
        <div className="koi-wrap" style={{ '--R': '78px', '--still-angle': '270deg', animationDelay: '-17.3s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="28" height="16" viewBox="0 0 32 18" style={{ color: 'var(--koi)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
      </div>

      {/* inner orbit: 2 jade koi, counterclockwise */}
      <div className="orbit ccw" style={{ '--T': '18s' } as React.CSSProperties}>
        <div className="koi-wrap" style={{ '--R': '48px', '--still-angle': '70deg', animationDelay: '0s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="24" height="14" viewBox="0 0 32 18" style={{ color: 'var(--jade)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
        <div className="koi-wrap" style={{ '--R': '48px', '--still-angle': '250deg', animationDelay: '-9s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="22" height="13" viewBox="0 0 32 18" style={{ color: 'var(--jade)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
      </div>

      {/* wide orbit: 1 amber koi */}
      <div className="orbit" style={{ '--T': '34s' } as React.CSSProperties}>
        <div className="koi-wrap" style={{ '--R': '80px', '--still-angle': '180deg', animationDelay: '-4s' } as React.CSSProperties}>
          <div className="koi">
            <svg className="koi-swimmer" width="25" height="14" viewBox="0 0 32 18" style={{ color: 'var(--amber)' }}>
              <use href="#koi-swimmer" />
            </svg>
            <span className="wake" />
          </div>
        </div>
      </div>

      <div className="core-mark" aria-hidden="true">
        <img src="/logo.png" alt="" draggable="false" />
      </div>
    </div>
  )
}
