import React, { useMemo } from 'react'

const AVG_WATTS_PER_VCPU = 8
const TICK_HOURS = 0.25
const USD_PER_KWH = 0.14

function pct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

export default function SavingsCard({ decisions, summary }) {
  const live = useMemo(() => {
    if (!decisions?.length) return null
    const intensities = decisions.map(d => Number(d.carbon_intensity))
    const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length
    const green = decisions.filter(d => d.action === 'scale_up')

    const runVcpuHours = green.reduce((s, d) => s + Number(d.batch_target_vcpus || 0), 0) * TICK_HOURS
    const counterfactualVcpus = Math.max(...decisions.map(d => Number(d.batch_target_vcpus || 0)), 0)
    const counterfactualVcpuHours = counterfactualVcpus * decisions.length * TICK_HOURS

    const gco2Actual = green.reduce((s, d) =>
      s + Number(d.batch_target_vcpus || 0) * TICK_HOURS * AVG_WATTS_PER_VCPU / 1000 * Number(d.carbon_intensity), 0)
    const gco2Counterfactual = counterfactualVcpuHours * AVG_WATTS_PER_VCPU / 1000 * avg
    const gco2Avoided = Math.max(gco2Counterfactual - gco2Actual, 0)
    const miles = gco2Avoided / 404

    const actualKwh = runVcpuHours * AVG_WATTS_PER_VCPU / 1000
    const counterfactualKwh = counterfactualVcpuHours * AVG_WATTS_PER_VCPU / 1000
    const actualUsd = actualKwh * USD_PER_KWH
    const counterfactualUsd = counterfactualKwh * USD_PER_KWH
    const usdSaved = Math.max(counterfactualUsd - actualUsd, 0)
    const pctCheaper = counterfactualUsd > 0 ? (usdSaved / counterfactualUsd) * 100 : null
    const pctCleaner = gco2Counterfactual > 0 ? (gco2Avoided / gco2Counterfactual) * 100 : null

    return { gco2Avoided, gco2Counterfactual, miles, runVcpuHours, avg, pctCheaper, pctCleaner }
  }, [decisions])

  const m = summary?.metrics || {}
  const avoided = m.gco2_avoided ?? live?.gco2Avoided
  const miles = live?.miles ?? (m.gco2_avoided ? m.gco2_avoided / 404 : null)
  const avg = m.avg_intensity_gco2_per_kwh ?? live?.avg
  const pctCheaper = live?.pctCheaper
  const pctCleaner = live?.pctCleaner

  if (avoided == null) {
    return <div className="loader-text">collecting 24h of decisions…</div>
  }

  const co2Val = avoided >= 1000
    ? `${(avoided / 1000).toFixed(2)} kg`
    : `${Math.round(avoided)} g`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* two percentage metrics */}
      <div className="sav-pct-row">
        <div className="sav-pct-item">
          <span className="sav-pct-value green">{pct(pctCleaner)}</span>
          <span className="sav-pct-label">cleaner</span>
        </div>
        <div className="sav-pct-item">
          <span className="sav-pct-value primary">{pct(pctCheaper)}</span>
          <span className="sav-pct-label">cheaper</span>
        </div>
      </div>
      {/* CO₂ avoided */}
      <div className="sav-co2">
        CO₂ avoided · <strong>{co2Val}</strong>
      </div>
      {/* miles */}
      {miles != null && (
        <div className="sav-miles">
          ≈ <strong>{miles.toFixed(1)}</strong> miles not driven
        </div>
      )}
      {/* avg intensity footer */}
      {avg != null && (
        <div className="sav-footer">
          avg grid · {Math.round(avg)} gCO₂/kWh
        </div>
      )}
    </div>
  )
}
