// Nimbus · Components
const { useState, useEffect, useRef, useMemo } = React

// ── Arc Gauge ────────────────────────────────────────────────────────────────
function ArcGauge({ pct, color, value, threshold, intensity }) {
  const MAX = 600, cx = 120, cy = 92, r = 84
  const pt = a => ({ x: cx - r * Math.cos(a), y: cy - r * Math.sin(a) })
  const arc = (t0, t1) => {
    const p0 = pt(Math.PI * t0), p1 = pt(Math.PI * t1)
    return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 0 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`
  }
  const needleAngle = Math.PI * Math.min(0.99, Math.max(0.01, pct))
  const np = pt(needleAngle)
  const tA = Math.PI * (threshold / MAX)
  const tIn = pt(tA - 0), tOuter = { x: cx - (r + 12) * Math.cos(tA), y: cy - (r + 12) * Math.sin(tA) }
  const tInner = { x: cx - (r - 12) * Math.cos(tA), y: cy - (r - 12) * Math.sin(tA) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: 240, height: 100 }}>
        <svg viewBox="0 0 240 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {/* track */}
          <path d={arc(0, 1)} stroke="var(--border)" strokeWidth={12} fill="none" />
          {/* zones */}
          <path d={arc(0, 250 / MAX)} stroke="rgba(58,158,100,0.28)" strokeWidth={12} fill="none" />
          <path d={arc(250 / MAX, 400 / MAX)} stroke="rgba(200,145,40,0.28)" strokeWidth={12} fill="none" />
          <path d={arc(400 / MAX, 1)} stroke="rgba(192,57,43,0.28)" strokeWidth={12} fill="none" />
          {/* active progress */}
          {intensity != null && <path d={arc(0, pct)} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" style={{ transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)' }} />}
          {/* threshold tick */}
          <line x1={tInner.x} y1={tInner.y} x2={tOuter.x} y2={tOuter.y} stroke="var(--text3)" strokeWidth={1.5} strokeLinecap="round" />
          {/* needle */}
          {intensity != null && <>
            <line x1={cx} y1={cy} x2={np.x} y2={np.y} stroke={color} strokeWidth={2.5} strokeLinecap="round"
              style={{ transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
            <circle cx={np.x} cy={np.y} r={4.5} fill={color} style={{ transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
          </>}
          <circle cx={cx} cy={cy} r={5} fill="var(--card)" stroke="var(--border)" strokeWidth={2} />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 42, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
      </div>
      <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: -4 }}>gCO₂ / kWh</div>
    </div>
  )
}

// ── Ring Gauge ───────────────────────────────────────────────────────────────
function RingGauge({ pct, color, value }) {
  const r = 70, size = 176
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(1, Math.max(0, pct)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', height: '100%' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={15} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={15}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transformOrigin: 'center', transform: 'rotate(-90deg)', transition: 'stroke-dashoffset 0.9s ease, stroke 0.5s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 36, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
          <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>gCO₂/kWh</span>
        </div>
      </div>
    </div>
  )
}

// ── Bar Gauge ────────────────────────────────────────────────────────────────
function BarGauge({ pct, color, value }) {
  return (
    <div style={{ width: '100%', padding: '4px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 56, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</span>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>gCO₂/kWh</span>
      </div>
      <div style={{ position: 'relative', height: 20, borderRadius: 6 }}>
        {/* zone bg */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: '41.67%', background: 'rgba(58,158,100,0.18)' }} />
          <div style={{ width: '25%', background: 'rgba(200,145,40,0.18)' }} />
          <div style={{ flex: 1, background: 'rgba(192,57,43,0.18)' }} />
        </div>
        {/* fill */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${Math.min(100, pct * 100)}%`, background: color, opacity: 0.55, borderRadius: 6, transition: 'width 0.9s ease' }} />
        {/* pointer */}
        <div style={{ position: 'absolute', top: -3, bottom: -3, width: 3, borderRadius: 2, background: color, left: `calc(${Math.min(100, pct * 100)}% - 1.5px)`, boxShadow: `0 0 8px ${color}88`, transition: 'left 0.9s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)' }}>
        {['0', '150', '250', '400', '600'].map(v => <span key={v}>{v}</span>)}
      </div>
    </div>
  )
}

// ── GaugeMeter ───────────────────────────────────────────────────────────────
function GaugeMeter({ intensity, threshold = 250, gaugeStyle = 'arc' }) {
  const MAX = 600
  const pct = Math.min(1, Math.max(0, (intensity ?? 0) / MAX))
  const color = intensity == null ? 'var(--text3)'
    : intensity <= threshold ? 'var(--green)'
    : intensity <= 400 ? 'var(--amber)'
    : 'var(--red)'
  const value = intensity != null ? Math.round(intensity) : '—'
  const isGreen = intensity != null && intensity <= threshold
  const props = { pct, color, value, threshold, intensity }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '4px 0' }}>
      {gaugeStyle === 'ring' && <RingGauge {...props} />}
      {gaugeStyle === 'bar' && <BarGauge {...props} />}
      {gaugeStyle === 'arc' && <ArcGauge {...props} />}
      <StatusBadge isGreen={isGreen} intensity={intensity} />
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ isGreen, intensity }) {
  const base = { display: 'inline-flex', alignItems: 'center', padding: '6px 16px', borderRadius: 20, fontFamily: 'DM Mono,monospace', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', border: '1.5px solid transparent', transition: 'all 0.5s ease' }
  if (intensity == null) return <span style={{ ...base, background: 'var(--border)', color: 'var(--text3)', borderColor: 'transparent' }}>Waiting…</span>
  const green = { ...base, background: 'rgba(58,158,100,0.1)', color: 'var(--green)', borderColor: 'rgba(58,158,100,0.25)' }
  const dirty = { ...base, background: 'rgba(192,57,43,0.08)', color: 'var(--red)', borderColor: 'rgba(192,57,43,0.22)' }
  return (
    <span style={isGreen ? green : dirty}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: isGreen ? 'var(--green)' : 'var(--red)', display: 'inline-block', marginRight: 8, boxShadow: isGreen ? '0 0 0 3px rgba(58,158,100,0.2)' : '0 0 0 3px rgba(192,57,43,0.2)' }} />
      {isGreen ? 'Green · Running' : 'Dirty · Paused'}
    </span>
  )
}

// ── Timeline Chart ────────────────────────────────────────────────────────────
function TimelineChart({ data, threshold }) {
  const [hov, setHov] = useState(null)
  const svgRef = useRef(null)

  const W = 900, H = 220
  const pad = { t: 18, r: 16, b: 36, l: 46 }
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b

  const sx = i => pad.l + (i / (data.length - 1)) * cW
  const sy = v => pad.t + cH - (Math.min(v, 620) / 640) * cH
  const thY = sy(threshold)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(d.intensity).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${sx(data.length - 1)},${pad.t + cH} L${pad.l},${pad.t + cH} Z`

  // dirty period rects
  const dirtyRects = []
  let ds = null
  data.forEach((d, i) => {
    if (d.action === 'scale_down' && ds === null) ds = i
    else if (d.action !== 'scale_down' && ds !== null) { dirtyRects.push({ x: sx(ds), w: sx(i) - sx(ds) }); ds = null }
  })
  if (ds !== null) dirtyRects.push({ x: sx(ds), w: sx(data.length - 1) - sx(ds) })

  // x labels every ~12 pts
  const xLabels = []
  const step = Math.max(1, Math.floor(data.length / 7))
  for (let i = 0; i < data.length; i += step) xLabels.push({ x: sx(i), label: new Date(data[i].t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })

  const yTicks = [0, 150, 300, 450, 600]
  const colW = cW / data.length

  const onMove = (e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const rx = (e.clientX - rect.left) / rect.width
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rx * (data.length - 1))))
    setHov({ idx, d: data[idx], svgX: sx(idx), svgY: sy(data[idx].intensity), cx: e.clientX, cy: e.clientY })
  }

  if (!data?.length) return <div style={{ padding: '24px 0', fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Collecting data…</div>

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <defs>
          <linearGradient id="tlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* dirty bands */}
        {dirtyRects.map((r, i) => <rect key={i} x={r.x} y={pad.t} width={Math.max(1, r.w)} height={cH} fill="rgba(192,57,43,0.055)" rx={1} />)}
        {/* grid */}
        {yTicks.map(v => <line key={v} x1={pad.l} y1={sy(v)} x2={pad.l + cW} y2={sy(v)} stroke="var(--border)" strokeWidth={1} />)}
        {/* area */}
        <path d={areaPath} fill="url(#tlGrad)" />
        {/* threshold */}
        <line x1={pad.l} y1={thY} x2={pad.l + cW} y2={thY} stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="5 4" opacity={0.75} />
        <text x={pad.l + cW - 4} y={thY - 5} textAnchor="end" fill="var(--amber)" fontSize={9} fontFamily="DM Mono,monospace" opacity={0.75}>250g threshold</text>
        {/* line */}
        <path d={linePath} stroke="var(--primary)" strokeWidth={2} fill="none" strokeLinejoin="round" />
        {/* hover */}
        {hov && <>
          <line x1={hov.svgX} y1={pad.t} x2={hov.svgX} y2={pad.t + cH} stroke="var(--primary)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <circle cx={hov.svgX} cy={hov.svgY} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2.5} />
        </>}
        {/* y labels */}
        {yTicks.map(v => <text key={v} x={pad.l - 8} y={sy(v) + 4} textAnchor="end" fill="var(--text3)" fontSize={10} fontFamily="DM Mono,monospace">{v}</text>)}
        {/* x labels */}
        {xLabels.map((l, i) => <text key={i} x={l.x} y={H - 7} textAnchor="middle" fill="var(--text3)" fontSize={10} fontFamily="DM Mono,monospace">{l.label}</text>)}
      </svg>
      {hov && (
        <div style={{ position: 'fixed', left: hov.cx + 14, top: hov.cy - 48, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontFamily: 'DM Mono,monospace', fontSize: 11, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', pointerEvents: 'none', zIndex: 200, minWidth: 148, transform: hov.cx > window.innerWidth * 0.72 ? 'translateX(calc(-100% - 28px))' : 'none' }}>
          <div style={{ color: 'var(--text3)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>{new Date(hov.d.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ color: 'var(--text)', fontWeight: 500, marginBottom: 4 }}>{Math.round(hov.d.intensity)} g/kWh</div>
          <div style={{ color: hov.d.action === 'scale_up' ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>{hov.d.action === 'scale_up' ? '↑ Running' : '↓ Paused'}</div>
        </div>
      )}
    </div>
  )
}

// ── Power Breakdown ───────────────────────────────────────────────────────────
const SOURCES = [
  { key: 'solar', label: 'Solar', color: '#f59e0b' },
  { key: 'wind', label: 'Wind', color: '#67e8f9' },
  { key: 'nuclear', label: 'Nuclear', color: '#a855f7' },
  { key: 'hydro', label: 'Hydro', color: '#3b82f6' },
  { key: 'geothermal', label: 'Geothermal', color: '#10b981' },
  { key: 'gas', label: 'Gas', color: '#94a3b8' },
  { key: 'coal', label: 'Coal', color: '#78716c' },
]
const CLEAN_KEYS = new Set(['solar', 'wind', 'nuclear', 'hydro', 'geothermal'])

function PowerBreakdown({ data }) {
  if (!data) return <div style={loadStyle}>Loading energy mix…</div>
  const entries = SOURCES.map(s => ({ ...s, mw: Math.max(0, data[s.key] ?? 0) })).filter(s => s.mw > 0).sort((a, b) => b.mw - a.mw)
  const total = entries.reduce((s, e) => s + e.mw, 0)
  if (!total) return <div style={loadStyle}>No production data</div>
  const cleanPct = Math.round(entries.filter(s => CLEAN_KEYS.has(s.key)).reduce((s, e) => s + e.mw, 0) / total * 100)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 20, fontWeight: 500, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(total).toLocaleString()}<span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 5 }}>MW</span>
        </span>
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 12, fontWeight: 500, color: 'var(--green)' }}>{cleanPct}% clean</span>
      </div>
      {/* stacked bar */}
      <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
        {entries.map(s => <div key={s.key} style={{ width: `${(s.mw / total) * 100}%`, background: s.color }} title={`${s.label}: ${Math.round(s.mw)} MW`} />)}
      </div>
      {/* rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {entries.map(s => (
          <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '96px 1fr 56px', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: 'var(--bg)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: s.color, width: `${(s.mw / total) * 100}%`, opacity: 0.8, transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textAlign: 'right' }}>{Math.round(s.mw)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Savings Card ──────────────────────────────────────────────────────────────
function SavingsCard({ gco2Avoided, pctCleaner, pctCheaper, miles, avgIntensity }) {
  const fmt = v => v != null ? `${Math.round(v)}%` : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', gap: 28 }}>
        <MetricPair value={fmt(pctCleaner)} label="Cleaner" color="var(--green)" />
        <MetricPair value={fmt(pctCheaper)} label="Cheaper" color="var(--primary)" />
      </div>
      {gco2Avoided != null && gco2Avoided > 0 && (
        <div>
          <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 28, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>
            {gco2Avoided >= 1000 ? `${(gco2Avoided / 1000).toFixed(1)} kg` : `${Math.round(gco2Avoided)} g`}
          </div>
          <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 3 }}>CO₂ avoided</div>
          {miles != null && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text2)', fontFamily: 'DM Mono,monospace' }}>≈ {miles.toFixed(1)} miles not driven</div>}
        </div>
      )}
      {avgIntensity != null && <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 10 }}>Avg grid · <span style={{ color: 'var(--text2)', fontWeight: 500 }}>{Math.round(avgIntensity)}</span> g/kWh</div>}
    </div>
  )
}

function MetricPair({ value, label, color }) {
  return (
    <div>
      <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 40, fontWeight: 500, color: color || 'var(--text)', letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 5 }}>{label}</div>
    </div>
  )
}

// ── Batch State Card ──────────────────────────────────────────────────────────
function BatchStateCard({ action, vcpus, checkedAt }) {
  const isRunning = action === 'scale_up'
  const color = action == null ? 'var(--text3)' : isRunning ? 'var(--green)' : 'var(--red)'
  const label = action == null ? 'Waiting' : isRunning ? 'Running' : 'Paused'
  const ago = checkedAt ? (() => {
    const m = Math.floor((Date.now() - checkedAt.getTime()) / 60000)
    if (m < 1) return 'just now'; if (m === 1) return '1 min ago'
    if (m < 60) return `${m} min ago`; return `${Math.floor(m / 60)}h ago`
  })() : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: isRunning ? '0 0 0 5px rgba(58,158,100,0.15)' : action ? '0 0 0 5px rgba(192,57,43,0.15)' : 'none' }} />
        <span style={{ fontFamily: 'DM Mono,monospace', fontSize: 30, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.015em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {vcpus != null && (
          <div>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 24, fontWeight: 500, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{vcpus}</div>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 3 }}>vCPUs</div>
          </div>
        )}
        {ago && (
          <div>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 14, color: 'var(--text2)', marginTop: 4 }}>{ago}</div>
            <div style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', marginTop: 3 }}>last check</div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {['ETL Pipeline', 'ML Training'].map(tag => (
          <span key={tag} style={{ fontFamily: 'DM Mono,monospace', fontSize: 10, color: isRunning ? 'var(--green)' : 'var(--text3)', background: isRunning ? 'rgba(58,158,100,0.1)' : 'var(--bg)', border: '1px solid', borderColor: isRunning ? 'rgba(58,158,100,0.25)' : 'var(--border)', borderRadius: 4, padding: '3px 8px', letterSpacing: '0.06em', transition: 'all 0.5s' }}>{isRunning ? '↑' : '↓'} {tag}</span>
        ))}
      </div>
    </div>
  )
}

// ── Decision Counts ───────────────────────────────────────────────────────────
function DecisionCounts({ history }) {
  const green = history.filter(d => d.action === 'scale_up').length
  const dirty = history.filter(d => d.action === 'scale_down').length
  const total = green + dirty
  const cleanPct = total > 0 ? Math.round((green / total) * 100) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <MetricPair value={String(green)} label="Green" color="var(--green)" />
        <MetricPair value={String(dirty)} label="Dirty" color="var(--red)" />
        <MetricPair value={total > 0 ? `${cleanPct}%` : '—'} label="Clean share" color="var(--text)" />
      </div>
      {total > 0 && (
        <div style={{ height: 4, borderRadius: 2, overflow: 'hidden', display: 'flex', background: 'var(--border)' }}>
          <div style={{ width: `${cleanPct}%`, background: 'var(--green)', transition: 'width 0.8s ease' }} />
          <div style={{ flex: 1, background: 'rgba(192,57,43,0.45)' }} />
        </div>
      )}
    </div>
  )
}

// ── Tweaks Panel ──────────────────────────────────────────────────────────────
function TweaksPanel({ tweaks, onChange, visible }) {
  if (!visible) return null
  const schemes = [
    { id: 'forest', label: 'Forest', dot: '#2d6a4f' },
    { id: 'ocean', label: 'Ocean', dot: '#1a6b7a' },
    { id: 'earth', label: 'Earth', dot: '#7a5c2a' },
  ]
  const gauges = [
    { id: 'arc', label: 'Arc' },
    { id: 'ring', label: 'Ring' },
    { id: 'bar', label: 'Bar' },
  ]
  const panelStyle = { position: 'fixed', bottom: 24, right: 24, width: 252, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 18px 20px', boxShadow: '0 8px 36px rgba(0,0,0,0.12)', zIndex: 300, fontFamily: 'DM Sans,sans-serif' }
  const secLabel = { fontFamily: 'DM Mono,monospace', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }
  return (
    <div style={panelStyle}>
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 18, letterSpacing: '-0.01em' }}>Tweaks</div>
      <div style={{ marginBottom: 18 }}>
        <div style={secLabel}>Color Scheme</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {schemes.map(s => (
            <button key={s.id} onClick={() => onChange({ scheme: s.id })}
              style={{ flex: 1, padding: '8px 4px 7px', border: `2px solid ${tweaks.scheme === s.id ? s.dot : 'var(--border)'}`, borderRadius: 9, background: tweaks.scheme === s.id ? `${s.dot}14` : 'transparent', cursor: 'pointer', fontFamily: 'DM Mono,monospace', fontSize: 10, color: tweaks.scheme === s.id ? s.dot : 'var(--text3)', letterSpacing: '0.05em', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: s.dot }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div style={secLabel}>Gauge Style</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {gauges.map(g => (
            <button key={g.id} onClick={() => onChange({ gaugeStyle: g.id })}
              style={{ flex: 1, padding: '7px 4px', border: `2px solid ${tweaks.gaugeStyle === g.id ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 7, background: tweaks.gaugeStyle === g.id ? 'var(--primary-light)' : 'transparent', cursor: 'pointer', fontFamily: 'DM Mono,monospace', fontSize: 10, color: tweaks.gaugeStyle === g.id ? 'var(--primary)' : 'var(--text3)', textTransform: 'capitalize', letterSpacing: '0.06em', transition: 'all 0.2s' }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const loadStyle = { fontFamily: 'DM Mono,monospace', fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px 0' }

Object.assign(window, { GaugeMeter, StatusBadge, TimelineChart, PowerBreakdown, SavingsCard, BatchStateCard, DecisionCounts, TweaksPanel })
