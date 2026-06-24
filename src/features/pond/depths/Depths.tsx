import { useState } from 'react'
import './depths.css'

const surfaceChips = ['All surfaces', 'Getting started', 'Chat modes', 'Lore library', 'Agents', 'Media', 'Pond Care', 'Deep water', 'Help']
const depthChips = ['All depths', 'Shallows', 'Deep', 'Murky', 'Surfacing soon']

export function Depths() {
  const [surfaceIdx, setSurfaceIdx] = useState(0)
  const [depthIdx, setDepthIdx] = useState(0)

  return (
    <div className="depths">
      <div className="depths-top">
        <div className="dic" aria-hidden="true">◉</div>
        <div>
          <h4>Sound the depths</h4>
          <p>Search DeKoi by what you want to do, then dive to the surface that owns it.</p>
        </div>
      </div>
      <div className="depths-search">
        <span className="glyph" aria-hidden="true">⌕</span>
        <input placeholder="Search features — e.g. voice, lore, webhook, narration…" />
      </div>
      <div className="chips" id="surfaceChips">
        {surfaceChips.map((chip, i) => (
          <span
            key={chip}
            className={`chip${surfaceIdx === i ? ' on' : ''}`}
            onClick={() => setSurfaceIdx(i)}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="chips depth" id="depthChips">
        {depthChips.map((chip, i) => (
          <span
            key={chip}
            className={`chip${depthIdx === i ? ' on' : ''}`}
            onClick={() => setDepthIdx(i)}
          >
            {chip}
          </span>
        ))}
      </div>
      <div className="pop-results">
        <div className="pop">
          <span className="pop-q">Voice narration</span>
          <span className="pop-to">→ Reserved</span>
        </div>
        <div className="pop">
          <span className="pop-q">Lore library</span>
          <span className="pop-to">→ Classic</span>
        </div>
        <div className="pop">
          <span className="pop-q">Webhook surface</span>
          <span className="pop-to">→ Deep water</span>
        </div>
      </div>
      <div className="depths-foot">
        <div className="stock">
          <span style={{ color: 'var(--jade)' }} aria-hidden="true">🜄</span>
          {' '}<b>42</b> features stocked in the pond
        </div>
        <button className="browse-all">⌄ Wade through all 42</button>
      </div>
    </div>
  )
}
