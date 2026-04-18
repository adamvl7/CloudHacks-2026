import React from 'react'

const SOURCES = [
  { key: 'nuclear',        label: 'Nuclear',         color: '#a855f7' },
  { key: 'hydro',          label: 'Hydro',           color: '#3b82f6' },
  { key: 'solar',          label: 'Solar',           color: '#f59e0b' },
  { key: 'wind',           label: 'Wind',            color: '#67e8f9' },
  { key: 'geothermal',     label: 'Geothermal',      color: '#b45309' },
  { key: 'biomass',        label: 'Biomass',         color: '#4ade80' },
  { key: 'hydro discharge',label: 'Hydro storage',   color: '#1d4ed8' },
  { key: 'battery discharge', label: 'Battery',      color: '#22c55e' },
  { key: 'gas',            label: 'Gas',             color: '#a8a29e' },
  { key: 'coal',           label: 'Coal',            color: '#57534e' },
  { key: 'oil',            label: 'Oil',             color: '#292524' },
  { key: 'unknown',        label: 'Unknown',         color: '#6b7280' },
]

export default function PowerBreakdown({ data }) {
  if (!data) {
    return <div className="loader">Loading energy mix…</div>
  }

  const production = data.powerProductionBreakdown || {}
  const entries = SOURCES
    .map(s => ({ ...s, mw: Math.max(0, production[s.key] ?? 0) }))
    .filter(s => s.mw > 0)

  const total = entries.reduce((sum, s) => sum + s.mw, 0)
  if (total === 0) return <div className="loader">No production data</div>

  const renewables = ['nuclear', 'hydro', 'solar', 'wind', 'geothermal', 'biomass', 'hydro discharge', 'battery discharge']
  const cleanMw = entries.filter(s => renewables.includes(s.key)).reduce((sum, s) => sum + s.mw, 0)
  const cleanPct = Math.round((cleanMw / total) * 100)

  return (
    <div className="power-breakdown">
      <div className="pb-summary">
        <span className="pb-total">{Math.round(total).toLocaleString()} <small>MW total</small></span>
        <span className="pb-clean" style={{ color: '#4ade80' }}>{cleanPct}% carbon-free</span>
      </div>
      <div className="pb-bars">
        {entries.sort((a, b) => b.mw - a.mw).map(s => (
          <div key={s.key} className="pb-row">
            <div className="pb-label">{s.label}</div>
            <div className="pb-track">
              <div
                className="pb-fill"
                style={{ width: `${(s.mw / total) * 100}%`, background: s.color }}
              />
            </div>
            <div className="pb-value">{Math.round(s.mw)} <small>MW</small></div>
          </div>
        ))}
      </div>
    </div>
  )
}
