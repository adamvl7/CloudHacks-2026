import React, { useEffect, useRef, useState } from 'react'

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

const WORKLOADS = [
  { id: 'etl',  label: 'ETL Pipeline',  share: 0.6, gCO2PerVcpuHr: 42, jobPrefix: 'etl-ingest' },
  { id: 'ml',   label: 'ML Training',   share: 0.4, gCO2PerVcpuHr: 58, jobPrefix: 'train-resnet' },
]

function formatNextGreen() {
  const h = 1 + Math.floor(Math.random() * 3)
  const m = Math.floor(Math.random() * 60)
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function WorkloadPopover({ workload, isRunning, totalVcpus, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  const wlVcpus = Math.round((totalVcpus ?? 0) * workload.share)
  const co2SavedG = isRunning ? 0 : Math.round(wlVcpus * workload.gCO2PerVcpuHr * 1)
  const co2Saved = co2SavedG > 1000
    ? `${(co2SavedG / 1000).toFixed(1)} kg`
    : `${co2SavedG} g`
  const nextGreen = formatNextGreen()
  const jobId = `${workload.jobPrefix}-${Math.floor(Math.random() * 900 + 100)}`

  return (
    <div ref={ref} className="wl-popover">
      <div className="wl-pop-head">
        <span className={`bsc-dot ${isRunning ? 'running' : 'paused'}`} />
        <strong>{workload.label}</strong>
        <button className="wl-pop-close" onClick={onClose} aria-label="close">×</button>
      </div>
      <div className="wl-pop-rows">
        <div className="wl-pop-row">
          <span>State</span>
          <strong>{isRunning ? 'Running' : 'Paused'}</strong>
        </div>
        <div className="wl-pop-row">
          <span>Allocated vCPUs</span>
          <strong>{wlVcpus}</strong>
        </div>
        <div className="wl-pop-row">
          <span>CO₂ saved today</span>
          <strong>{co2Saved}</strong>
        </div>
        <div className="wl-pop-row">
          <span>{isRunning ? 'Current job' : 'Next green window'}</span>
          <strong>{isRunning ? jobId : nextGreen}</strong>
        </div>
      </div>
    </div>
  )
}

export default function BatchStateCard({ action, vcpus, checkedAt }) {
  const isRunning = action === 'scale_up'
  const [openId, setOpenId] = useState(null)

  if (action == null) {
    return <div className="loader-text">loading region preview...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="bsc-state">
        <span className={`bsc-dot ${isRunning ? 'running' : 'paused'}`} />
        <span className="bsc-state-label">{isRunning ? 'Run' : 'Pause'}</span>
      </div>
      <div className="bsc-vcpus">
        preview vCPUs - <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{String(vcpus ?? '—')}</strong>
      </div>
      <div className="bsc-time">
        grid sample - <strong>{relTime(checkedAt)}</strong>
      </div>
      <div className="bsc-tags">
        {WORKLOADS.map(w => (
          <div key={w.id} className="wl-tag-wrap">
            <button
              className="bsc-tag bsc-tag-btn"
              onClick={() => setOpenId(openId === w.id ? null : w.id)}
            >
              {isRunning ? '▲' : '▼'} {w.label} preview
            </button>
            {openId === w.id && (
              <WorkloadPopover
                workload={w}
                isRunning={isRunning}
                totalVcpus={vcpus}
                onClose={() => setOpenId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
