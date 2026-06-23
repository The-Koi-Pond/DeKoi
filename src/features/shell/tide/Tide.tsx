import './Tide.css'

export function Tide() {
  return (
    <footer className="tide">
      <div className="swim-state">
        <span className="pulse" />
        {' '}Swimming
      </div>
      <div className="surface-input">
        <input placeholder="Set your surface — what are you up to?" />
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
