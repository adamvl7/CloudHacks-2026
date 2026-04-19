import React from 'react'

const SOURCES = [
  { key: 'solar',           label: 'Solar',        color: '#f59e0b', clean: true,  renewable: true  },
  { key: 'wind',            label: 'Wind',         color: '#67e8f9', clean: true,  renewable: true  },
  { key: 'nuclear',         label: 'Nuclear',      color: '#a855f7', clean: true,  renewable: false },
  { key: 'hydro',           label: 'Hydro',        color: '#3b82f6', clean: true,  renewable: true  },
  { key: 'geothermal',      label: 'Geothermal',   color: '#10b981', clean: true,  renewable: true  },
  { key: 'biomass',         label: 'Biomass',      color: '#4ade80', clean: true,  renewable: true  },
  { key: 'hydro discharge', label: 'Hydro storage',color: '#1d4ed8', clean: true,  renewable: true  },
  { key: 'battery discharge',label:'Battery',      color: '#22c55e', clean: true,  renewable: true  },
  { key: 'gas',             label: 'Gas',          color: '#94a3b8', clean: false, renewable: false },
  { key: 'coal',            label: 'Coal',         color: '#78716c', clean: false, renewable: false },
  { key: 'oil',             label: 'Oil',          color: '#292524', clean: false, renewable: false },
  { key: 'unknown',         label: 'Unknown',      color: '#6b7280', clean: false, renewable: false },
]

function MiniDonut({ pct, label, color }) {
  const r = 26
  const c = 2 * Math.PI * r
  const safe = Math.max(0, Math.min(100, pct))
  const dash = (safe / 100) * c
  return (
    <div className="pb2-donut">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={c / 4}
          strokeLinecap="round" transform="rotate(-90 32 32)" />
        <text x="32" y="36" textAnchor="middle"
          style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, fontWeight: 600, fill: 'var(--text)' }}>
          {Math.round(safe)}%
        </text>
      </svg>
      <div className="pb2-donut-label">{label}</div>
    </div>
  )
}

export default function PowerBreakdown({ data }) {
  if (!data) {
    return <div className="loader-text">Loading energy mix…</div>
  }

  // ElectricityMaps returns nested powerProductionBreakdown; mock/legacy returns flat object
  const production = data.powerProductionBreakdown || data || {}
  const entries = SOURCES
    .map(s => ({ ...s, mw: Math.max(0, production[s.key] ?? 0) }))
    .filter(s => s.mw > 0)
    .sort((a, b) => b.mw - a.mw)

  const total = entries.reduce((sum, s) => sum + s.mw, 0)
  if (total === 0) return <div className="loader-text">No production data</div>

  const cleanMw = entries.filter(s => s.clean).reduce((sum, s) => sum + s.mw, 0)
  const renewableMw = entries.filter(s => s.renewable).reduce((sum, s) => sum + s.mw, 0)
  const cleanPct = Math.round((cleanMw / total) * 100)
  const renewablePct = Math.round((renewableMw / total) * 100)

  return (
    <div className="power-breakdown" style={{ width: '100%' }}>
      {/* header */}
      <div className="pb2-header">
        <span className="pb2-total">
          {Math.round(total).toLocaleString()}
          <small> MW total</small>
        </span>
        <span className="pb2-clean">{cleanPct}% carbon-free</span>
      </div>

      {/* donuts */}
      <div className="pb2-donuts">
        <MiniDonut pct={cleanPct} label="Carbon-free" color="#9ac78a" />
        <MiniDonut pct={renewablePct} label="Renewable" color="#67e8f9" />
      </div>

      {/* stacked bar */}
      <div className="pb2-stack-bar">
        {entries.map(s => (
          <div key={s.key} className="pb2-stack-seg"
            style={{ width: `${(s.mw / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${Math.round(s.mw)} MW`} />
        ))}
      </div>

      {/* rows */}
      <div className="pb2-rows">
        {entries.map(s => (
          <div key={s.key} className="pb2-row">
            <div className="pb2-dot" style={{ background: s.color }} />
            <div className="pb2-label">{s.label}</div>
            <div className="pb2-track">
              <div className="pb2-fill" style={{ width: `${(s.mw / total) * 100}%`, background: s.color }} />
            </div>
            <div className="pb2-mw">{Math.round(s.mw)} MW</div>
          </div>
        ))}
      </div>
    </div>
  )
}
