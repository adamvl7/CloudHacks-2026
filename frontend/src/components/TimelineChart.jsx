import React, { useRef, useState } from 'react'

const pad = { t: 18, r: 16, b: 36, l: 46 }
const W = 900, H = 220
const innerW = W - pad.l - pad.r
const innerH = H - pad.t - pad.b
const Y_MAX = 600
const Y_LINES = [0, 150, 300, 450, 600]

function scaleX(t, tMin, tMax) {
  if (tMax === tMin) return pad.l
  return pad.l + ((t - tMin) / (tMax - tMin)) * innerW
}
function scaleY(v) {
  return pad.t + innerH - (v / Y_MAX) * innerH
}

export default function TimelineChart({ data = [], threshold = 250 }) {
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)

  const pts = data.filter(d => d.t != null && Number.isFinite(d.intensity))
  if (pts.length < 2) {
    return (
      <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span className="loader-text">Not enough data for chart</span>
      </div>
    )
  }

  const tMin = pts[0].t
  const tMax = pts[pts.length - 1].t

  // build SVG polyline / area
  const coords = pts.map(d => ({
    x: scaleX(d.t, tMin, tMax),
    y: scaleY(d.intensity),
    ...d,
  }))

  const linePoints = coords.map(c => `${c.x},${c.y}`).join(' ')
  const areaPoints = [
    `${coords[0].x},${pad.t + innerH}`,
    ...coords.map(c => `${c.x},${c.y}`),
    `${coords[coords.length-1].x},${pad.t + innerH}`,
  ].join(' ')

  // dirty period rects (runs of scale_down)
  const dirtyRects = []
  let dirtyStart = null
  for (let i = 0; i < coords.length; i++) {
    const isDirty = coords[i].action === 'scale_down'
    if (isDirty && dirtyStart == null) dirtyStart = coords[i].x
    if (!isDirty && dirtyStart != null) {
      dirtyRects.push({ x: dirtyStart, w: coords[i].x - dirtyStart })
      dirtyStart = null
    }
  }
  if (dirtyStart != null) {
    dirtyRects.push({ x: dirtyStart, w: coords[coords.length-1].x - dirtyStart })
  }

  // x-axis labels every ~12 points or fewer
  const labelEvery = Math.max(1, Math.floor(pts.length / 8))
  const xLabels = pts.filter((_, i) => i % labelEvery === 0)

  const handleMouseMove = (e) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = (e.clientX - rect.left) * (W / rect.width)
    let best = null, bestDist = Infinity
    coords.forEach(c => {
      const dist = Math.abs(c.x - mx)
      if (dist < bestDist) { bestDist = dist; best = c }
    })
    if (best && bestDist < 40) {
      setTooltip({ x: best.x, y: best.y, d: best })
    } else {
      setTooltip(null)
    }
  }

  const threshY = scaleY(threshold)

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible', display:'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* dirty period shading */}
        {dirtyRects.map((dr, i) => (
          <rect key={i} x={dr.x} y={pad.t} width={dr.w} height={innerH}
            fill="rgba(192,57,43,0.055)" />
        ))}

        {/* horizontal grid lines */}
        {Y_LINES.map(v => {
          const y = scaleY(v)
          return (
            <g key={v}>
              <line x1={pad.l} y1={y} x2={pad.l + innerW} y2={y}
                stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 6} y={y} textAnchor="end" dominantBaseline="middle"
                fill="var(--text3)" fontSize="10" fontFamily="DM Mono,monospace">{v}</text>
            </g>
          )
        })}

        {/* area fill */}
        <polygon points={areaPoints} fill="url(#area-grad)" />

        {/* threshold dashed line */}
        <line x1={pad.l} y1={threshY} x2={pad.l + innerW} y2={threshY}
          stroke="var(--amber)" strokeWidth="1.5" strokeDasharray="6 4" />
        <text x={pad.l + innerW + 4} y={threshY} dominantBaseline="middle"
          fill="var(--amber)" fontSize="9" fontFamily="DM Mono,monospace">THR</text>

        {/* main line */}
        <polyline points={linePoints} fill="none"
          stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* x-axis labels */}
        {xLabels.map((d, i) => {
          const x = scaleX(d.t, tMin, tMax)
          const label = new Date(d.t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
          return (
            <text key={i} x={x} y={H - 6} textAnchor="middle"
              fill="var(--text3)" fontSize="10" fontFamily="DM Mono,monospace">{label}</text>
          )
        })}

        {/* crosshair + hover dot */}
        {tooltip && (
          <>
            <line x1={tooltip.x} y1={pad.t} x2={tooltip.x} y2={pad.t + innerH}
              stroke="var(--text3)" strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={tooltip.x} cy={tooltip.y} r="5"
              fill="var(--primary)" stroke="var(--card)" strokeWidth="2" />
          </>
        )}
      </svg>

      {/* tooltip */}
      {tooltip && (() => {
        const d = tooltip.d
        const time = new Date(d.t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
        const isUp = d.action === 'scale_up'
        return (
          <div style={{
            position:'absolute',
            left: Math.min(tooltip.x / W * 100, 80) + '%',
            top: tooltip.y / H * 100 + '%',
            transform:'translate(8px,-50%)',
            background:'var(--card)',
            border:'1px solid var(--border)',
            borderRadius:8,
            padding:'8px 12px',
            boxShadow:'0 4px 16px rgba(0,0,0,0.10)',
            pointerEvents:'none',
            zIndex:10,
            minWidth:130,
          }}>
            <div style={{fontFamily:'DM Mono,monospace',fontSize:10,color:'var(--text3)',
              letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:4}}>{time}</div>
            <div style={{fontFamily:'DM Mono,monospace',fontSize:16,fontWeight:500,
              color:'var(--text)',marginBottom:2}}>
              {Math.round(d.intensity)} <span style={{fontSize:9,color:'var(--text3)'}}>gCO₂/kWh</span>
            </div>
            <div style={{fontSize:12,color: isUp ? 'var(--green)' : 'var(--red)',fontWeight:500}}>
              {isUp ? '▲ Running' : '▼ Paused'}
              {d.vcpus > 0 && <span style={{color:'var(--text3)',fontWeight:400}}> · {d.vcpus} vCPUs</span>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
