import type { NavContextType } from '../../../shared/ui/nav-context'
import './CareDrawer.css'
import './care-fields.css'

interface CareDrawerProps {
  nav: NavContextType
}

export function CareDrawer({ nav }: CareDrawerProps) {
  const open = nav.careOpen
  return (
    <>
      <div className={`scrim${open ? ' open' : ''}`} id="scrim" onClick={() => nav.setCareOpen(false)} />
      <aside className={`care${open ? ' open' : ''}`} id="care">
        <div className="care-head">
          <div className="top">
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <use href="#koi-mark" style={{ color: 'var(--koi)' }} />
            </svg>
            <h2>Pond Care</h2>
            <div
              className="x"
              role="button"
              tabIndex={0}
              aria-label="Close Pond Care"
              onClick={() => nav.setCareOpen(false)}
            >
              ✕
            </div>
          </div>
          <p>Tend the water De-Koi swims in. Changes settle instantly across every surface.</p>
        </div>

        <div className="care-tabs">
          {['Water', 'Light', 'Season', 'Habitat', 'Companions', 'Stocking', 'Vitals', 'Deep water'].map((tab, i) => (
            <div
              key={tab}
              className={`ctab${nav.careTab === i ? ' on' : ''}`}
              onClick={() => nav.setCareTab(i)}
            >
              {tab}
              <small>{['general', 'look', 'themes', 'modules', 'extensions', 'import', 'health', 'advanced'][i]}</small>
            </div>
          ))}
        </div>

        <div className="care-body">
          <p className="care-intro">
            Water settings shape how the whole pond behaves — language, flow, and the small currents of everyday use.
          </p>

          {nav.careTab === 0 && (
            <>
              <div className="field">
                <label>Language of the water</label>
                <select className="pondsel"><option>English</option></select>
                <div className="help">
                  English is the only current bundled for now. New languages will surface here as they're stocked — without disturbing your layout.
                </div>
              </div>

              <div className="toggle-row">
                <div className="tl"><b>Let replies ripple in</b><i>stream responses word by word</i></div>
                <div className="switch on" data-toggle><i /></div>
              </div>
              <div className="toggle-row">
                <div className="tl"><b>Spotify mini player</b><i>a little music by the pond</i></div>
                <div className="switch" data-toggle><i /></div>
              </div>

              <div className="slider-field">
                <div className="sl-top"><b>Ripple speed</b><span>50</span></div>
                <div className="track" data-track><div className="fill" style={{ width: '50%' }} /><div className="knob" style={{ left: '50%' }} /></div>
                <div className="track-ends"><span>Still</span><span>Rushing</span></div>
              </div>

              <div className="toggle-row">
                <div className="tl"><b>Surface all text at once</b><i>skip the reveal, show it all</i></div>
                <div className="switch" data-toggle><i /></div>
              </div>
              <div className="toggle-row">
                <div className="tl"><b>Wheel + click to navigate</b><i>scroll through the depths</i></div>
                <div className="switch" data-toggle><i /></div>
              </div>

              <div className="slider-field">
                <div className="sl-top"><b>Narration drift</b><span>50</span></div>
                <div className="track" data-track><div className="fill" style={{ width: '50%' }} /><div className="knob" style={{ left: '50%' }} /></div>
                <div className="track-ends"><span>Still</span><span>Rushing</span></div>
              </div>

              <div className="slider-field">
                <div className="sl-top"><b>Auto-play pause between segments</b><span>3.0s</span></div>
                <div className="track" data-track><div className="fill" style={{ width: '30%' }} /><div className="knob" style={{ left: '30%' }} /></div>
                <div className="track-ends"><span>Short</span><span>Long</span></div>
              </div>

              <div className="field">
                <label>Send on Enter</label>
                <div className="help" style={{ marginTop: 0, marginBottom: 10 }}>Choose which surfaces send when you press Enter.</div>
                <div className="seg">
                  <div className="opt">VN</div>
                  <div className="opt on">Bubbles</div>
                  <div className="opt">Reserved</div>
                </div>
              </div>

              <div className="toggle-row" style={{ borderBottom: 'none' }}>
                <div className="tl"><b>Ask before releasing a koi</b><i>confirm before deleting</i></div>
                <div className="switch on" data-toggle><i /></div>
              </div>
            </>
          )}

          {nav.careTab > 0 && (
            <p style={{ color: 'var(--mist)', fontSize: 13, marginTop: 20 }}>
              {nav.careTab === 1 ? 'Light / look settings — coming soon.' :
               nav.careTab === 2 ? 'Season / themes — coming soon.' :
               nav.careTab === 3 ? 'Habitat / modules — coming soon.' :
               nav.careTab === 4 ? 'Companions / extensions — coming soon.' :
               nav.careTab === 5 ? 'Stocking / import — coming soon.' :
               nav.careTab === 6 ? 'Vitals / health — coming soon.' :
               'Deep water / advanced — coming soon.'}
            </p>
          )}
        </div>
      </aside>
    </>
  )
}
