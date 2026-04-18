import React from 'react'

const MAX = 600

function color(intensity) {
  if (intensity == null) return '#6b6f66'
  if (intensity <= 250) return '#9ac78a'
  if (intensity <= 400) return '#d4a54c'
  return '#c56a58'
}

function state(intensity, threshold) {
  if (intensity == null) return { label: '—', kind: 'green' }
  return intensity <= threshold
    ? { label: 'Green · running', kind: 'green' }
    : { label: 'Dirty · paused', kind: 'dirty' }
}

// Semicircle gauge, 0–600 gCO₂/kWh.
export default function GridMeter({ intensity, threshold = 250, source }) {
  const pct = Math.min(1, Math.max(0, (intensity ?? 0) / MAX))
  const angle = Math.PI * pct
  const cx = 120, cy = 120, r = 100
  const needleX = cx - r * Math.cos(angle)
  const needleY = cy - r * Math.sin(angle)
  const s = state(intensity, threshold)

  // threshold tick position on the arc
  const tAngle = Math.PI * (threshold / MAX)
  const tInner = { x: cx - (r - 10) * Math.cos(tAngle), y: cy - (r - 10) * Math.sin(tAngle) }
  const tOuter = { x: cx - (r + 10) * Math.cos(tAngle), y: cy - (r + 10) * Math.sin(tAngle) }

  const arc = (startPct, endPct, stroke) => {
    const a0 = Math.PI * startPct
    const a1 = Math.PI * endPct
    const x0 = cx - r * Math.cos(a0), y0 = cy - r * Math.sin(a0)
    const x1 = cx - r * Math.cos(a1), y1 = cy - r * Math.sin(a1)
    return (
      <path
        d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
        stroke={stroke}
        strokeWidth="10"
        fill="none"
        strokeLinecap="butt"
      />
    )
  }

  return (
    <div className="meter-wrap">
      <div className="meter">
        <svg viewBox="0 0 240 140">
          {/* base track */}
          {arc(0, 1, '#1e221e')}
          {/* colored zones, slightly inset for subtlety */}
          {arc(0, 250 / MAX, 'rgba(154, 199, 138, 0.55)')}
          {arc(250 / MAX, 400 / MAX, 'rgba(212, 165, 76, 0.55)')}
          {arc(400 / MAX, 1, 'rgba(197, 106, 88, 0.55)')}

          {/* threshold tick */}
          <line
            x1={tInner.x} y1={tInner.y}
            x2={tOuter.x} y2={tOuter.y}
            stroke="#a6a99f"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* needle */}
          {intensity != null && (
            <>
              <line
                x1={cx} y1={cy}
                x2={needleX} y2={needleY}
                stroke={color(intensity)}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx={needleX} cy={needleY} r="4" fill={color(intensity)} />
            </>
          )}
          <circle cx={cx} cy={cy} r="4" fill="#2a2f2a" />
        </svg>
        <div className="meter-value">
          {intensity != null ? Math.round(intensity) : '—'}
          <div className="meter-unit">gCO₂ / kWh</div>
        </div>
      </div>
      <span className={`badge ${s.kind}`}>{s.label}</span>
      {source && <div className="meter-source">source · {source}</div>}
    </div>
  )
}
