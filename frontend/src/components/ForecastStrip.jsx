import React, { useMemo } from 'react'

function findNextGreenWindow(forecast, threshold) {
  if (!forecast?.length) return null
  const now = Date.now()
  for (const p of forecast) {
    const t = new Date(p.datetime).getTime()
    if (Number.isNaN(t)) continue
    if (t < now) continue
    if (Number(p.carbonIntensity) <= threshold) {
      const hoursAway = Math.max(0, (t - now) / 3_600_000)
      return { datetime: p.datetime, hoursAway }
    }
  }
  return null
}

function fmtRel(hours) {
  if (hours < 0.75) return 'within the hour'
  if (hours < 1.5) return 'in ~1h'
  return `in ~${Math.round(hours)}h`
}

export default function ForecastStrip({ data }) {
  const threshold = data?.threshold ?? 250
  const forecast = Array.isArray(data?.forecast) ? data.forecast.slice(0, 24) : []
  const next = useMemo(() => findNextGreenWindow(forecast, threshold), [forecast, threshold])

  if (!data || !forecast.length) {
    return (
      <>
        <h4 className="forecast-subhead">Next 24h forecast</h4>
        <div className="loader">forecast unavailable…</div>
      </>
    )
  }

  const max = Math.max(...forecast.map(p => Number(p.carbonIntensity) || 0), threshold)

  return (
    <>
      <div className="forecast-head">
        <h4 className="forecast-subhead">Next 24h forecast</h4>
        {next && (
          <div className="forecast-callout">
            <span className="forecast-callout-dot" />
            Next green window: {fmtRel(next.hoursAway)}
          </div>
        )}
      </div>
      <div className="forecast-strip" role="img" aria-label="24 hour carbon intensity forecast">
        {forecast.map((p, i) => {
          const v = Number(p.carbonIntensity) || 0
          const h = Math.max(6, (v / max) * 100)
          const dirty = v > threshold
          return (
            <div key={i} className="forecast-col" title={`${new Date(p.datetime).toLocaleTimeString([], { hour: '2-digit' })} · ${Math.round(v)} g/kWh`}>
              <div
                className={`forecast-bar ${dirty ? 'dirty' : 'green'}`}
                style={{ height: `${h}%` }}
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
