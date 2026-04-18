import React, { useMemo } from 'react'

const AVG_WATTS_PER_VCPU = 8
const TICK_HOURS = 0.25

function fmt(n) {
  if (n == null || Number.isNaN(n)) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return `${Math.round(n)}`
}

export default function SavingsCard({ decisions, summary }) {
  const live = useMemo(() => {
    if (!decisions?.length) return null
    const intensities = decisions.map(d => Number(d.carbon_intensity))
    const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length
    const green = decisions.filter(d => d.action === 'scale_up')
    const runVcpuHours = green.reduce((s, d) => s + Number(d.batch_target_vcpus || 0), 0) * TICK_HOURS
    const counterfactualVcpus = Math.max(...green.map(d => Number(d.batch_target_vcpus || 0)), 0)
    const counterfactualVcpuHours = counterfactualVcpus * decisions.length * TICK_HOURS
    const gco2Actual = green.reduce((s, d) =>
      s + Number(d.batch_target_vcpus || 0) * TICK_HOURS * AVG_WATTS_PER_VCPU / 1000 * Number(d.carbon_intensity), 0)
    const gco2Counterfactual = counterfactualVcpuHours * AVG_WATTS_PER_VCPU / 1000 * avg
    const gco2Avoided = Math.max(gco2Counterfactual - gco2Actual, 0)
    const miles = gco2Avoided / 404
    return { gco2Avoided, miles, runVcpuHours, avg }
  }, [decisions])

  const m = summary?.metrics || {}
  const avoided = m.gco2_avoided ?? live?.gco2Avoided
  const miles = live?.miles ?? (m.gco2_avoided ? m.gco2_avoided / 404 : null)
  const avg = m.avg_intensity_gco2_per_kwh ?? live?.avg
  const ranVcpuHours = m.vcpu_hours_run ?? live?.runVcpuHours

  if (avoided == null) {
    return (
      <>
        <h3>CO₂ avoided (last 24h)</h3>
        <div className="loader">collecting 24h of decisions…</div>
      </>
    )
  }

  return (
    <>
      <h3>CO₂ avoided (last 24h)</h3>
      <div className="savings-headline">
        <div className="metric">{fmt(avoided)}</div>
        <div className="metric-unit">grams</div>
      </div>
      {miles != null && (
        <div className="subtle">≈ <strong>{miles.toFixed(1)}</strong> miles not driven (avg passenger car)</div>
      )}
      <dl className="savings-detail">
        <div>
          <dt>Avg intensity</dt>
          <dd>{Math.round(avg)} <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>g/kWh</span></dd>
        </div>
        <div>
          <dt>vCPU · hours run</dt>
          <dd>{ranVcpuHours?.toFixed ? ranVcpuHours.toFixed(1) : ranVcpuHours}</dd>
        </div>
      </dl>
    </>
  )
}
