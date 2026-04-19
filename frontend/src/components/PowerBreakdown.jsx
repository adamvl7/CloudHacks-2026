import React from 'react'

const SOURCES = [
  { key: 'solar',           label: 'Solar',        color: '#f59e0b', clean: true  },
  { key: 'wind',            label: 'Wind',         color: '#67e8f9', clean: true  },
  { key: 'nuclear',         label: 'Nuclear',      color: '#a855f7', clean: true  },
  { key: 'hydro',           label: 'Hydro',        color: '#3b82f6', clean: true  },
  { key: 'geothermal',      label: 'Geothermal',   color: '#10b981', clean: true  },
  { key: 'biomass',         label: 'Biomass',      color: '#4ade80', clean: true  },
  { key: 'hydro discharge', label: 'Hydro storage',color: '#1d4ed8', clean: true  },
  { key: 'battery discharge',label:'Battery',      color: '#22c55e', clean: true  },
  { key: 'gas',             label: 'Gas',          color: '#94a3b8', clean: false },
  { key: 'coal',            label: 'Coal',         color: '#78716c', clean: false },
  { key: 'oil',             label: 'Oil',          color: '#292524', clean: false },
  { key: 'unknown',         label: 'Unknown',      color: '#6b7280', clean: false },
]

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
  const cleanPct = Math.round((cleanMw / total) * 100)

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
