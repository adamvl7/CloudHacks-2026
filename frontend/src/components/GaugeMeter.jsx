import React from 'react'

/* ─── Status Badge ─── */
function StatusBadge({ isGreen, intensity }) {
  if (intensity == null) {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:7,
        padding:'5px 12px', borderRadius:6,
        background:'rgba(138,158,135,0.1)', color:'var(--text3)',
        fontFamily:'DM Mono,monospace', fontSize:11, fontWeight:500,
        letterSpacing:'0.12em', textTransform:'uppercase',
        border:'1px solid var(--border)',
      }}>
        <span style={{width:6,height:6,borderRadius:'50%',background:'var(--text3)',display:'inline-block'}} />
        Waiting
      </span>
    )
  }
  const color = isGreen ? 'var(--green)' : 'var(--red)'
  const bg    = isGreen ? 'rgba(58,158,100,0.09)' : 'rgba(192,57,43,0.09)'
  const bdCol = isGreen ? 'rgba(58,158,100,0.22)' : 'rgba(192,57,43,0.22)'
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:7,
      padding:'5px 12px', borderRadius:6,
      background:bg, color, border:`1px solid ${bdCol}`,
      fontFamily:'DM Mono,monospace', fontSize:11, fontWeight:500,
      letterSpacing:'0.12em', textTransform:'uppercase',
    }}>
      <span style={{width:6,height:6,borderRadius:'50%',background:color,display:'inline-block'}} />
      {isGreen ? 'Green' : 'Dirty'}
    </span>
  )
}

/* ─── Arc Gauge ─── */
function ArcGauge({ pct, color, value, threshold, intensity }) {
  const MAX = 600
  const cx = 120, cy = 112, r = 86
  const clampedThreshold = Math.min(MAX, Math.max(0, Number(threshold) || 0))
  const greenEnd = clampedThreshold / MAX
  const amberEnd = Math.min(1, (clampedThreshold + 120) / MAX)
  const angle = Math.PI * pct
  const needleX = cx - r * Math.cos(angle)
  const needleY = cy - r * Math.sin(angle)

  const arc = (s, e, stroke, sw = 10) => {
    const a0 = Math.PI * s, a1 = Math.PI * e
    const x0 = cx - r * Math.cos(a0), y0 = cy - r * Math.sin(a0)
    const x1 = cx - r * Math.cos(a1), y1 = cy - r * Math.sin(a1)
    return (
      <path d={`M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
        stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="butt" />
    )
  }

  // threshold tick
  const tA = Math.PI * greenEnd
  const tIn  = { x: cx - (r-11)*Math.cos(tA), y: cy - (r-11)*Math.sin(tA) }
  const tOut = { x: cx - (r+11)*Math.cos(tA), y: cy - (r+11)*Math.sin(tA) }

  return (
    <svg viewBox="0 0 240 150" width="100%" height="150" style={{display:'block', maxWidth:260, overflow:'hidden'}}>
      {/* track */}
      {arc(0, 1, 'var(--border)', 10)}
      {/* zone arcs */}
      {greenEnd > 0 && arc(0, greenEnd, 'rgba(58,158,100,0.35)', 10)}
      {amberEnd > greenEnd && arc(greenEnd, amberEnd, 'rgba(181,117,42,0.35)', 10)}
      {amberEnd < 1 && arc(amberEnd, 1, 'rgba(192,57,43,0.35)', 10)}
      {/* progress arc */}
      {intensity != null && arc(0, pct, color, 10)}
      {/* threshold tick */}
      <line x1={tIn.x} y1={tIn.y} x2={tOut.x} y2={tOut.y}
        stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round" />
      {/* needle */}
      {intensity != null && (
        <>
          <line x1={cx} y1={cy} x2={needleX} y2={needleY}
            stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={needleX} cy={needleY} r="4" fill={color} />
        </>
      )}
      {/* pivot */}
      <circle cx={cx} cy={cy} r="5" fill="var(--card)" stroke="var(--border)" strokeWidth="1.5" />
      {/* value text */}
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="auto"
        fontSize="0" fill="transparent">
        {/* spacer — actual value rendered below SVG */}
      </text>
    </svg>
  )
}

/* ─── Ring Gauge ─── */
function RingGauge({ pct, color, value }) {
  const r = 70
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - pct)
  return (
    <div style={{position:'relative',width:176,height:176}}>
      <svg width="176" height="176" style={{transform:'rotate(-90deg)'}}>
        <circle cx="88" cy="88" r={r} fill="none"
          stroke="var(--border)" strokeWidth="12" />
        <circle cx="88" cy="88" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{transition:'stroke-dashoffset 0.6s ease, stroke 0.3s ease'}} />
      </svg>
      <div style={{
        position:'absolute', inset:0,
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', gap:2,
      }}>
        <span style={{
          fontFamily:'DM Mono,monospace', fontSize:36, fontWeight:500,
          color:'var(--text)', letterSpacing:'-0.03em', lineHeight:1,
          fontVariantNumeric:'tabular-nums',
        }}>{value}</span>
        <span style={{fontFamily:'DM Mono,monospace',fontSize:10,color:'var(--text3)',
          letterSpacing:'0.1em',textTransform:'uppercase'}}>gCO₂/kWh</span>
      </div>
    </div>
  )
}

/* ─── Bar Gauge ─── */
function BarGauge({ pct, color, value }) {
  const MAX = 600
  const stops = [0, 150, 250, 400, 600]
  return (
    <div style={{width:'100%',padding:'0 4px'}}>
      <div style={{
        fontFamily:'DM Mono,monospace', fontSize:56, fontWeight:500,
        color:'var(--text)', letterSpacing:'-0.04em', lineHeight:1,
        fontVariantNumeric:'tabular-nums', marginBottom:14,
        textAlign:'center',
      }}>{value}</div>
      {/* zone bg */}
      <div style={{position:'relative',height:12,borderRadius:6,overflow:'hidden',
        background:`linear-gradient(to right,
          rgba(58,158,100,0.25) 0%,rgba(58,158,100,0.25) ${250/MAX*100}%,
          rgba(181,117,42,0.25) ${250/MAX*100}%,rgba(181,117,42,0.25) ${400/MAX*100}%,
          rgba(192,57,43,0.25) ${400/MAX*100}%,rgba(192,57,43,0.25) 100%)`}}>
        {/* fill overlay */}
        <div style={{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${pct*100}%`, background:color, borderRadius:6,
          opacity:0.9, transition:'width 0.5s',
        }} />
        {/* pointer */}
        <div style={{
          position:'absolute', top:-4, left:`${pct*100}%`,
          width:3, height:20, background:color,
          transform:'translateX(-50%)', borderRadius:2,
          transition:'left 0.5s',
        }} />
      </div>
      {/* labels */}
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        {stops.map(v => (
          <span key={v} style={{fontFamily:'DM Mono,monospace',fontSize:9,
            color:'var(--text3)',letterSpacing:'0.04em'}}>{v}</span>
        ))}
      </div>
    </div>
  )
}

/* ─── GaugeMeter wrapper ─── */
export default function GaugeMeter({ intensity, threshold = 250, gaugeStyle = 'arc' }) {
  const MAX = 600
  const pct = Math.min(1, Math.max(0, (intensity ?? 0) / MAX))
  const color = intensity == null ? 'var(--text3)'
    : intensity <= threshold ? 'var(--green)'
    : intensity <= 400 ? 'var(--amber)' : 'var(--red)'
  const value = intensity != null ? Math.round(intensity) : '—'
  const isGreen = intensity != null && intensity <= threshold

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'2px 0',overflow:'hidden',width:'100%'}}>
      {gaugeStyle === 'ring' && <RingGauge pct={pct} color={color} value={value} />}
      {gaugeStyle === 'bar'  && <BarGauge  pct={pct} color={color} value={value} />}
      {gaugeStyle === 'arc'  && (
        <>
          <ArcGauge pct={pct} color={color} value={value} threshold={threshold} intensity={intensity} />
          <div style={{fontFamily:'DM Mono,monospace',fontSize:32,fontWeight:500,
            color:'var(--text)',letterSpacing:'-0.03em',lineHeight:1,
            fontVariantNumeric:'tabular-nums',marginTop:-4}}>
            {value}
            <span style={{fontSize:11,color:'var(--text3)',letterSpacing:'0.1em',
              textTransform:'uppercase',marginLeft:6}}>gCO₂/kWh</span>
          </div>
        </>
      )}
      {gaugeStyle === 'bar' && (
        <div style={{fontFamily:'DM Mono,monospace',fontSize:11,color:'var(--text3)',
          letterSpacing:'0.1em',textTransform:'uppercase'}}>gCO₂/kWh</div>
      )}
      <StatusBadge isGreen={isGreen} intensity={intensity} />
    </div>
  )
}
