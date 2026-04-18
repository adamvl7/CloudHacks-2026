import React from 'react'

function color(intensity) {
  if (intensity == null) return '#64748b'
  if (intensity <= 250) return 'var(--green)'
  if (intensity <= 400) return 'var(--amber)'
  return 'var(--red)'
}

function state(intensity, threshold) {
  if (intensity == null) return { label: '—', kind: 'green' }
  return intensity <= threshold
    ? { label: 'Green · running', kind: 'green' }
    : { label: 'Dirty · paused', kind: 'dirty' }
}

// Semicircle gauge: 180° arc, scale 0–600 gCO2/kWh.
export default function GridMeter({ intensity, threshold = 250, source }) {
  const max = 600
  const pct = Math.min(1, Math.max(0, (intensity ?? 0) / max))
  const angle = Math.PI * pct
  const cx = 110, cy = 110, r = 95
  const x = cx - r * Math.cos(angle)
  const y = cy - r * Math.sin(angle)
  const s = state(intensity, threshold)

  const arc = (startPct, endPct, stroke) => {
    const a0 = Math.PI * startPct
    const a1 = Math.PI * endPct
    const x0 = cx - r * Math.cos(a0), y0 = cy - r * Math.sin(a0)
    const x1 = cx - r * Math.cos(a1), y1 = cy - r * Math.sin(a1)
    return <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`} stroke={stroke} strokeWidth="14" fill="none" strokeLinecap="round" />
  }

  return (
    <div className="meter-wrap">
      <div className="meter">
        <svg viewBox="0 0 220 130">
          {arc(0, 250 / max, '#14532d')}
          {arc(250 / max, 400 / max, '#78350f')}
          {arc(400 / max, 1, '#4c1d1d')}
          {intensity != null && (
            <line x1={cx} y1={cy} x2={x} y2={y}
                  stroke={color(intensity)} strokeWidth="4" strokeLinecap="round" />
          )}
          <circle cx={cx} cy={cy} r="6" fill={color(intensity)} />
        </svg>
        <div className="meter-value">
          {intensity != null ? Math.round(intensity) : '—'}
          <div className="meter-unit">gCO₂ / kWh</div>
        </div>
      </div>
      <span className={`badge ${s.kind}`}>{s.label}</span>
      {source && <div className="subtle">source: {source}</div>}
    </div>
  )
}
