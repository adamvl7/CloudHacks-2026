import React, { useEffect, useState } from 'react'
import GridMeter from './components/GridMeter.jsx'
import DecisionTimeline from './components/DecisionTimeline.jsx'
import SavingsCard from './components/SavingsCard.jsx'
import DailySummary from './components/DailySummary.jsx'
import { getCurrent, getDecisions, getLatestSummary } from './api/ecoshiftClient.js'

const REFRESH_MS = 30_000

export default function App() {
  const [current, setCurrent] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [c, d, s] = await Promise.all([
          getCurrent().catch(() => null),
          getDecisions(24).catch(() => []),
          getLatestSummary().catch(() => null),
        ])
        if (cancelled) return
        setCurrent(c)
        setDecisions(d)
        setSummary(s)
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

  return (
    <div className="app">
      <header className="header">
        <div>
          <div className="brand">
            <span className="brand-accent">Eco</span>Shift
          </div>
          <div className="tagline">Carbon-aware workload scheduler · AWS Cloud Hacks 2026</div>
        </div>
        <div className="subtle">refresh every 30s</div>
      </header>

      {error && <div className="error">API error: {error}</div>}

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
              <div className="metric" style={{ fontSize: 22 }}>
                {current.decision.action === 'scale_up' ? '⬆  Running' : '⏸  Paused'}
              </div>
              <div className="subtle">
                target vCPUs: <strong>{String(current.decision.batch_target_vcpus ?? '—')}</strong>
              </div>
              <div className="subtle">
                last checked: {new Date(current.decision.sk).toLocaleString()}
              </div>
            </>
          ) : (
            <div className="loader">waiting for first scheduler tick…</div>
          )}
        </div>

        <div className="card wide">
          <h3>24h decision timeline</h3>
          <DecisionTimeline decisions={decisions} threshold={threshold} />
        </div>

        <div className="card">
          <h3>Decision counts</h3>
          <div style={{ display: 'flex', gap: 18 }}>
            <div>
              <div className="subtle">green</div>
              <div className="metric" style={{ color: 'var(--green)' }}>
                {decisions.filter(d => d.action === 'scale_up').length}
              </div>
            </div>
            <div>
              <div className="subtle">dirty</div>
              <div className="metric" style={{ color: 'var(--red)' }}>
                {decisions.filter(d => d.action === 'scale_down').length}
              </div>
            </div>
          </div>
        </div>

        <div className="card full">
          <h3>Latest Bedrock sustainability report</h3>
          <DailySummary summary={summary} />
        </div>
      </div>

      <footer>
        Built with AWS Lambda · Batch · DynamoDB · Bedrock (Claude) · CloudFront
      </footer>
    </div>
  )
}
