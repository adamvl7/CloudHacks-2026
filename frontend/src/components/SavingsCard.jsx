import React, { useMemo } from 'react'

const AVG_WATTS_PER_VCPU = 8
const TICK_HOURS = 0.25

function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
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
    const energyActualKwh = green.reduce((s, d) =>
      s + Number(d.batch_target_vcpus || 0) * TICK_HOURS * AVG_WATTS_PER_VCPU / 1000, 0)
    const gco2Actual = green.reduce((s, d) =>
      s + Number(d.batch_target_vcpus || 0) * TICK_HOURS * AVG_WATTS_PER_VCPU / 1000 * Number(d.carbon_intensity), 0)
    const gco2Counterfactual = counterfactualVcpuHours * AVG_WATTS_PER_VCPU / 1000 * avg
    const gco2Avoided = Math.max(gco2Counterfactual - gco2Actual, 0)
    const miles = gco2Avoided / 404
    return { gco2Avoided, miles, runVcpuHours, avg }
  }, [decisions])

  const src = summary?.metrics || live
  if (!src) return <div className="loader">no data yet</div>

  const avoided = summary?.metrics?.gco2_avoided ?? live?.gco2Avoided ?? 0
  const equiv = summary?.metrics?.real_world_equivalent
    ?? (live ? `≈ ${live.miles.toFixed(1)} miles not driven` : '')
  const avg = summary?.metrics?.avg_intensity_gco2_per_kwh ?? live?.avg ?? 0
  const ranVcpuHours = summary?.metrics?.vcpu_hours_run ?? live?.runVcpuHours ?? 0

  return (
    <div>
      <h3>CO₂ avoided (last 24h)</h3>
      <div className="metric">{fmt(avoided)} <span style={{ fontSize: 16, color: 'var(--text-dim)' }}>g</span></div>
      <div className="subtle">{equiv}</div>
      <div style={{ marginTop: 14, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div className="subtle" style={{ fontSize: 11 }}>Avg intensity</div>
          <div style={{ fontWeight: 600 }}>{Math.round(avg)} gCO₂/kWh</div>
        </div>
        <div>
          <div className="subtle" style={{ fontSize: 11 }}>vCPU·hours run</div>
          <div style={{ fontWeight: 600 }}>{ranVcpuHours.toFixed ? ranVcpuHours.toFixed(1) : ranVcpuHours}</div>
        </div>
      </div>
    </div>
  )
}
