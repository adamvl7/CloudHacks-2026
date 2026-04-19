import React, { useMemo } from 'react'

export default function RegionCompareBanner({ data }) {
  const best = useMemo(() => {
    if (!data?.current_zone || !Array.isArray(data?.regions)) return null
    const current = data.regions.find(r => r.zone === data.current_zone)
    const currentIntensity = current ? Number(current.carbonIntensity) : null
    if (currentIntensity == null || !Number.isFinite(currentIntensity) || currentIntensity <= 0) return null

    let candidate = null
    for (const r of data.regions) {
      if (r.zone === data.current_zone) continue
      const v = Number(r.carbonIntensity)
      if (!Number.isFinite(v)) continue
      const pct = ((currentIntensity - v) / currentIntensity) * 100
      if (pct >= 15 && (!candidate || pct > candidate.pct)) {
        candidate = { ...r, pct }
      }
    }
    return candidate
  }, [data])

  if (!best) return null

  const label = best.label || best.zone

  return (
    <div className="region-banner">
      <span className="region-banner-arrow" aria-hidden="true" />
      <span>
        <strong>{label}</strong> is <strong>{Math.round(best.pct)}%</strong> cleaner than <strong>{data.current_zone}</strong> right now — shift queue?
      </span>
    </div>
  )
}
