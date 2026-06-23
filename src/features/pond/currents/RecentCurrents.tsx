import './currents.css'

const drifters = [
  {
    initial: 'A',
    bg: 'linear-gradient(140deg,#54d2c8,#1f9c93)',
    name: 'Azur',
    time: '12m ago',
    msg: "The storm hasn't passed yet…",
    mode: 'vn' as const,
    unread: true,
  },
  {
    initial: 'A',
    bg: 'linear-gradient(140deg,#54d2c8,#1f9c93)',
    name: 'Azur — branch',
    time: '3h ago',
    msg: 'A second current, branching off',
    mode: 'vn' as const,
  },
  {
    initial: 'K',
    bg: 'linear-gradient(140deg,#f0c659,#d39a26)',
    name: 'Kingfisher Keep',
    time: 'yesterday',
    msg: 'Turn 14 · party rests by the weir',
    mode: 'reserved' as const,
  },
]

export function RecentCurrents() {
  return (
    <>
      <div className="section-head">
        <span className="eyebrow">Recent currents</span>
        <span className="hint">koi you were swimming with</span>
        <span className="more">See the whole shoal →</span>
      </div>
      <div className="current">
        {drifters.map((d) => (
          <div key={d.name} className={`drifter${d.unread ? '' : ''}`} data-unread={d.unread || undefined}>
            <div className="da" style={{ background: d.bg }}>{d.initial}</div>
            <div className="db">
              <div className="dt">
                <span className="dn">{d.name}</span>
                <span className="dtime">{d.time}</span>
              </div>
              <div className="dmsg">{d.msg}</div>
            </div>
            <span className={`dmode ${d.mode}`}>{d.mode === 'vn' ? 'VN' : 'Reserved'}</span>
          </div>
        ))}
      </div>
    </>
  )
}
