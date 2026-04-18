import React, { useEffect, useMemo, useState } from 'react'
import GridMeter from './components/GridMeter.jsx'
import DecisionTimeline from './components/DecisionTimeline.jsx'
import SavingsCard from './components/SavingsCard.jsx'
import DailySummary from './components/DailySummary.jsx'
import PowerBreakdown from './components/PowerBreakdown.jsx'
import { getCurrent, getDecisions, getLatestSummary, getPowerBreakdown } from './api/ecoshiftClient.js'

const REFRESH_MS = 30_000

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

export default function App() {
  const [current, setCurrent] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [summary, setSummary] = useState(null)
  const [powerBreakdown, setPowerBreakdown] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, d, s, pb] = await Promise.all([
          getCurrent().catch(() => null),
          getDecisions(24).catch(() => []),
          getLatestSummary().catch(() => null),
          getPowerBreakdown().catch(() => null),
        ])
        if (cancelled) return
        setCurrent(c)
        setDecisions(d)
        setSummary(s)
        setPowerBreakdown(pb)
        setLastFetch(new Date())
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message || 'failed to load')
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const intensity = current?.decision?.carbon_intensity != null
    ? Number(current.decision.carbon_intensity)
    : null
  const threshold = current?.threshold ?? 250
  const source = current?.decision?.source
  const zone = current?.decision?.zone ?? 'US-CAL-CISO'
  const action = current?.decision?.action
  const targetVcpus = current?.decision?.batch_target_vcpus
  const lastCheckedAt = current?.decision?.sk ? new Date(current.decision.sk) : null

  const state = intensity == null ? 'idle' : (intensity <= threshold ? 'green' : 'dirty')

  useEffect(() => {
    document.body.dataset.state = state
  }, [state])

  const counts = useMemo(() => {
    const green = decisions.filter(d => d.action === 'scale_up').length
    const dirty = decisions.filter(d => d.action === 'scale_down').length
    return { green, dirty, total: green + dirty }
  }, [decisions])

  return (
    <div className="app">
      <header className="header">
        <div className="brand-row">
          <div className="brand">
            Eco<span className="brand-accent">Shift</span>
          </div>
          <div className="tagline">Carbon-aware scheduler</div>
        </div>
        <div className="header-meta">
          <span><span className="live-dot" />Live</span>
          <span>{zone}</span>
          <span>{lastFetch ? lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
        </div>
      </header>

      {error && <div className="error">Connection: {error}</div>}

      <div className="grid">
        <div className="card">
          <h3>Current grid intensity</h3>
          <GridMeter intensity={intensity} threshold={threshold} source={source} />
        </div>

        <div className="card">
          <SavingsCard decisions={decisions} summary={summary} />
        </div>

        <div className="card">
          <h3>Last batch decision</h3>
          {current?.decision ? (
            <>
              <div className={`decision-state ${action === 'scale_up' ? 'running' : 'paused'}`}>
                <span className="dot" />
                {action === 'scale_up' ? 'Running' : 'Paused'}
              </div>
              <div className="decision-meta">
                <div className="subtle">target vCPUs · <strong>{String(targetVcpus ?? '—')}</strong></div>
                <div className="subtle">checked <strong>{relTime(lastCheckedAt)}</strong></div>
              </div>
            </>
          ) : (
            <div className="loader">waiting for first scheduler tick…</div>
          )}
        </div>

        <div className="card wide">
          <h3>24h decision timeline</h3>
          <DecisionTimeline decisions={decisions} threshold={threshold} />
          <div className="chart-legend">
            <span><i /> Carbon intensity</span>
            <span><i className="fill" /> vCPUs running</span>
            <span><i className="dash" /> Threshold ({threshold} g)</span>
          </div>
        </div>

        <div className="card">
          <h3>Decision counts (last 24h)</h3>
          <dl className="counts">
            <div>
              <dt>Green</dt>
              <div className="num green">{counts.green}</div>
            </div>
            <div>
              <dt>Dirty</dt>
              <div className="num red">{counts.dirty}</div>
            </div>
            <div>
              <dt>Clean share</dt>
              <div className="num">{counts.total > 0 ? `${Math.round((counts.green / counts.total) * 100)}%` : '—'}</div>
            </div>
          </dl>
          {counts.total > 0 && (
            <div className="split-track">
              <div className="split-green" style={{ width: `${(counts.green / counts.total) * 100}%` }} />
              <div className="split-dirty" style={{ width: `${(counts.dirty / counts.total) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="card">
          <h3>Energy mix · {zone}</h3>
          <PowerBreakdown data={powerBreakdown} />
        </div>

        <div className="card full">
          <h3>Bedrock sustainability report</h3>
          <DailySummary summary={summary} />
        </div>
      </div>

      <footer>
        <span>AWS Lambda · Batch · DynamoDB · Bedrock · CloudFront</span>
        <span>Cloud Hacks 2026</span>
      </footer>
    </div>
  )
}
