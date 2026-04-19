import React from 'react'

function relTime(d) {
  if (!d) return '—'
  const diff = Math.max(0, Date.now() - d.getTime())
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m === 1) return '1 min ago'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

export default function BatchStateCard({ action, vcpus, checkedAt }) {
  const isRunning = action === 'scale_up'
  if (action == null) {
    return (
      <div className="loader-text">waiting for first tick…</div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="bsc-state">
        <span className={`bsc-dot ${isRunning ? 'running' : 'paused'}`} />
        <span className="bsc-state-label">{isRunning ? 'Running' : 'Paused'}</span>
      </div>
      <div className="bsc-vcpus">
        target vCPUs · <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{String(vcpus ?? '—')}</strong>
      </div>
      <div className="bsc-time">
        last check · <strong>{relTime(checkedAt)}</strong>
      </div>
      <div className="bsc-tags">
        <span className="bsc-tag">
          {isRunning ? '▲' : '▼'} ETL Pipeline
        </span>
        <span className="bsc-tag">
          {isRunning ? '▲' : '▼'} ML Training
        </span>
      </div>
    </div>
  )
}
