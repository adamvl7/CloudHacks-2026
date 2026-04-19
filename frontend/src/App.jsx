import React, { useEffect, useMemo, useState } from 'react'
import GaugeMeter from './components/GaugeMeter.jsx'
import TimelineChart from './components/TimelineChart.jsx'
import SavingsCard from './components/SavingsCard.jsx'
import BatchStateCard from './components/BatchStateCard.jsx'
import DecisionCounts from './components/DecisionCounts.jsx'
import PowerBreakdown from './components/PowerBreakdown.jsx'
import AskEcoShift from './components/AskEcoShift.jsx'
import {
  getCurrent,
  getDecisions,
  getLatestSummary,
  getPowerBreakdown,
} from './api/ecoshiftClient.js'

/* ─── Color schemes ─── */
const SCHEMES = {
  forest: {},  // default :root vars — no overrides needed
  aws: {
    '--bg':'#f7f8fa','--card':'#fff','--border':'#e3e7ec',
    '--sidebar-bg':'#ffffff','--sidebar-border':'rgba(0,0,0,0.07)',
    '--sidebar-accent':'#ff9900',
    '--text':'#16202c','--text2':'#3d5166','--text3':'#8a9bb0',
    '--primary':'#ff9900','--primary-light':'rgba(255,153,0,0.1)',
    '--green':'#1a8a4a','--amber':'#e07a00','--red':'#d13212',
    '--sb-title':'#3d5166','--sb-sub':'rgba(0,0,0,0.3)',
    '--sb-section':'rgba(0,0,0,0.22)',
    '--sb-nav':'rgba(0,0,0,0.45)','--sb-nav-hover-bg':'rgba(255,153,0,0.08)',
    '--sb-nav-hover':'#ff9900','--sb-nav-active-bg':'rgba(255,153,0,0.12)',
    '--sb-nav-active':'#ff9900','--sb-zone':'rgba(0,0,0,0.38)',
    '--sb-time':'rgba(0,0,0,0.22)','--sb-toggle-border':'rgba(0,0,0,0.12)',
    '--sb-toggle-color':'rgba(0,0,0,0.4)',
  },
  google: {
    '--bg':'#f8f9ff','--card':'#fff','--border':'#e1e8f5',
    '--sidebar-bg':'#202124','--sidebar-border':'rgba(255,255,255,0.07)',
    '--sidebar-accent':'#4285f4',
    '--text':'#202124','--text2':'#3c4a5e','--text3':'#80909e',
    '--primary':'#4285f4','--primary-light':'rgba(66,133,244,0.08)',
    '--green':'#34a853','--amber':'#fbbc05','--red':'#ea4335',
    '--sb-title':'#fff','--sb-sub':'rgba(255,255,255,0.3)',
    '--sb-section':'rgba(255,255,255,0.2)',
    '--sb-nav':'rgba(255,255,255,0.42)','--sb-nav-hover-bg':'rgba(255,255,255,0.07)',
    '--sb-nav-hover':'rgba(255,255,255,0.85)','--sb-nav-active-bg':'rgba(255,255,255,0.1)',
    '--sb-nav-active':'#fff','--sb-zone':'rgba(255,255,255,0.38)',
    '--sb-time':'rgba(255,255,255,0.2)','--sb-toggle-border':'rgba(255,255,255,0.14)',
    '--sb-toggle-color':'rgba(255,255,255,0.5)',
  },
}

/* default forest vars (used to reset when switching to forest) */
const FOREST_VARS = {
  '--bg':'#f5f7f3','--card':'#fff','--border':'#e6ece3',
  '--sidebar-bg':'#1a2e1e','--sidebar-border':'rgba(255,255,255,0.07)',
  '--sidebar-accent':'#52b788',
  '--text':'#1a2418','--text2':'#4a5c47','--text3':'#8a9e87',
  '--primary':'#2d6a4f','--primary-light':'rgba(45,106,79,0.08)',
  '--green':'#3a9e64','--amber':'#b5752a','--red':'#c0392b',
  '--sb-title':'#fff','--sb-sub':'rgba(255,255,255,0.3)',
  '--sb-section':'rgba(255,255,255,0.2)',
  '--sb-nav':'rgba(255,255,255,0.42)','--sb-nav-hover-bg':'rgba(255,255,255,0.07)',
  '--sb-nav-hover':'rgba(255,255,255,0.85)','--sb-nav-active-bg':'rgba(255,255,255,0.1)',
  '--sb-nav-active':'#fff','--sb-zone':'rgba(255,255,255,0.38)',
  '--sb-time':'rgba(255,255,255,0.2)','--sb-toggle-border':'rgba(255,255,255,0.14)',
  '--sb-toggle-color':'rgba(255,255,255,0.5)',
}

function applyScheme(name) {
  const base = name === 'forest' ? FOREST_VARS : SCHEMES[name] || {}
  Object.entries(base).forEach(([k, v]) =>
    document.documentElement.style.setProperty(k, v)
  )
}

/* ─── Icons (inline SVG) ─── */
function IconOverview() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="1" y="1" width="6" height="6" rx="1.2" />
      <rect x="9" y="1" width="6" height="6" rx="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
    </svg>
  )
}
function IconTimeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <polyline points="1,12 5,7 9,10 13,4 15,5" />
    </svg>
  )
}
function IconReports() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="2" y="1" width="12" height="14" rx="1.5" />
      <line x1="5" y1="5" x2="11" y2="5" />
      <line x1="5" y1="8" x2="11" y2="8" />
      <line x1="5" y1="11" x2="8" y2="11" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06" />
    </svg>
  )
}
function IconTweaks() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="2" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.75 2.75l1.06 1.06M10.19 10.19l1.06 1.06M2.75 11.25l1.06-1.06M10.19 3.81l1.06-1.06" />
    </svg>
  )
}

const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview',  Icon: IconOverview  },
  { id: 'timeline',  label: 'Timeline',  Icon: IconTimeline  },
  { id: 'reports',   label: 'Reports',   Icon: IconReports   },
  { id: 'settings',  label: 'Settings',  Icon: IconSettings  },
]

/* ─── CloudLogo ─── */
function CloudLogo({ size = 36 }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 50 36" fill="var(--sidebar-accent)">
      <circle cx="33" cy="14" r="11" />
      <circle cx="20" cy="18" r="8.5" />
      <circle cx="10" cy="21" r="6" />
      <rect x="4" y="21" width="40" height="11" rx="5.5" />
    </svg>
  )
}

/* ─── helper ─── */
const REFRESH_MS = 30_000

/* ─── Pages ─── */
function OverviewPage({ data }) {
  const { intensity, threshold, zone, action, targetVcpus, lastCheckedAt,
          isGreen, decisions, timelineData, summary, powerBreakdown,
          gaugeStyle } = data

  return (
    <>
      <div className="grid g4 mb16">
        <div className="card">
          <div className="card-label">Grid Intensity</div>
          <GaugeMeter intensity={intensity} threshold={threshold} gaugeStyle={gaugeStyle} />
        </div>
        <div className="card">
          <div className="card-label">Batch Status</div>
          <BatchStateCard action={action} vcpus={targetVcpus} checkedAt={lastCheckedAt} />
        </div>
        <div className="card">
          <div className="card-label">Savings · Last 24h</div>
          <SavingsCard decisions={decisions} summary={summary} />
        </div>
        <div className="card">
          <div className="card-label">Decision Counts · 24h</div>
          <DecisionCounts decisions={decisions} />
        </div>
      </div>

      <div className="card mb16">
        <div className="card-label">24h Decision Timeline</div>
        <TimelineChart data={timelineData} threshold={threshold} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-label">Energy Mix · {zone}</div>
          <PowerBreakdown data={powerBreakdown} />
        </div>
        <div className="card">
          <div className="card-label">Bedrock Sustainability Report</div>
          <p style={{ fontStyle: 'italic', lineHeight: 1.7, color: 'var(--text2)', fontSize: 14 }}>
            {summary?.narrative || summary?.metrics ? (
              summary.narrative || 'Summary available — see Reports page for full details.'
            ) : 'No daily brief yet…'}
          </p>
          <div className="narrative-byline">Generated by Amazon Bedrock · Claude Sonnet 4</div>
        </div>
      </div>
    </>
  )
}

function TimelinePage({ data }) {
  const { decisions, timelineData, threshold } = data
  const green = decisions.filter(d => d.action === 'scale_up').length
  const dirty = decisions.filter(d => d.action === 'scale_down').length
  const total = green + dirty
  const cleanShare = total > 0 ? Math.round((green / total) * 100) : null
  const intensities = decisions.map(d => Number(d.carbon_intensity)).filter(Number.isFinite)
  const avgInt = intensities.length > 0
    ? Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length) : null
  const minInt = intensities.length > 0 ? Math.round(Math.min(...intensities)) : null
  const maxInt = intensities.length > 0 ? Math.round(Math.max(...intensities)) : null

  return (
    <>
      <div className="grid g4 mb16">
        <div className="card">
          <div className="card-label">Total Decisions</div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">last 24h</div>
        </div>
        <div className="card">
          <div className="card-label">Clean Share</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {cleanShare != null ? `${cleanShare}%` : '—'}
          </div>
          <div className="stat-label">scale-up decisions</div>
        </div>
        <div className="card">
          <div className="card-label">Avg Intensity</div>
          <div className="stat-value">{avgInt ?? '—'}</div>
          <div className="stat-label">gCO₂/kWh</div>
        </div>
        <div className="card">
          <div className="card-label">Intensity Range</div>
          <div className="stat-value">{minInt ?? '—'} – {maxInt ?? '—'}</div>
          <div className="stat-label">gCO₂/kWh</div>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-label">Decision Timeline · 24h</div>
        <TimelineChart data={timelineData} threshold={threshold} />
      </div>

      <div className="card">
        <div className="card-label">Decision Log</div>
        {decisions.length === 0 ? (
          <div className="loader-text">No decisions recorded yet</div>
        ) : (
          <div className="log-scroll">
            <table className="log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Intensity</th>
                  <th>State</th>
                  <th>Action</th>
                  <th>vCPUs</th>
                </tr>
              </thead>
              <tbody>
                {[...decisions].reverse().map((d, i) => {
                  const t = d.sk ? new Date(d.sk).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
                  const intVal = Number(d.carbon_intensity)
                  const isUp = d.action === 'scale_up'
                  const isGreen = Number.isFinite(intVal) && intVal <= threshold
                  return (
                    <tr key={i}>
                      <td style={{ fontFamily: 'DM Mono, monospace', fontSize: 12 }}>{t}</td>
                      <td style={{ fontFamily: 'DM Mono, monospace' }}>
                        <span style={{ color: isGreen ? 'var(--green)' : intVal > 400 ? 'var(--red)' : 'var(--amber)' }}>
                          {Number.isFinite(intVal) ? Math.round(intVal) : '—'}
                        </span>
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}> g</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: isGreen ? 'var(--green)' : 'var(--red)' }}>
                          {isGreen ? 'Green' : 'Dirty'}
                        </span>
                      </td>
                      <td>
                        <span className={isUp ? 'tag-up' : 'tag-down'}>
                          {isUp ? '▲' : '▼'} {isUp ? 'scale_up' : 'scale_down'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'DM Mono, monospace' }}>
                        {d.batch_target_vcpus ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function ReportsPage({ data }) {
  const { summary } = data
  const [expanded, setExpanded] = useState(false)

  if (!summary) {
    return (
      <div className="card">
        <div className="card-label">Bedrock Reports</div>
        <div className="loader-text">No reports generated yet</div>
      </div>
    )
  }

  const m = summary.metrics || {}
  const date = summary.date || summary.sk || 'Today'
  const gco2 = m.gco2_avoided
  const hoursShifted = m.hours_shifted ?? m.vcpu_hours_run
  const cleanPct = m.clean_pct ?? m.clean_share

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="report-card">
        <div className="report-date">{date}</div>
        <div className="report-metrics">
          {gco2 != null && (
            <div className="report-metric">
              <div className="report-metric-val">
                {gco2 >= 1000 ? `${(gco2 / 1000).toFixed(2)} kg` : `${Math.round(gco2)} g`}
              </div>
              <div className="report-metric-key">CO₂ avoided</div>
            </div>
          )}
          {hoursShifted != null && (
            <div className="report-metric">
              <div className="report-metric-val">
                {typeof hoursShifted === 'number' ? hoursShifted.toFixed(1) : hoursShifted}
              </div>
              <div className="report-metric-key">hours shifted</div>
            </div>
          )}
          {cleanPct != null && (
            <div className="report-metric">
              <div className="report-metric-val" style={{ color: 'var(--green)' }}>
                {Math.round(cleanPct)}%
              </div>
              <div className="report-metric-key">clean share</div>
            </div>
          )}
        </div>
        {summary.narrative && (
          <>
            <p className="report-narrative" style={{ display: expanded ? 'block' : '-webkit-box',
              WebkitLineClamp: expanded ? undefined : 4,
              WebkitBoxOrient: 'vertical',
              overflow: expanded ? 'visible' : 'hidden',
            }}>
              {summary.narrative}
            </p>
            <button className="report-expand-btn" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Show less ↑' : 'Read more ↓'}
            </button>
          </>
        )}
        <div className="narrative-byline">Generated by Amazon Bedrock · Claude Sonnet 4</div>
      </div>
    </div>
  )
}

function SettingsPage({ tweaks, setTweaks, threshold, zone }) {
  const [localThreshold, setLocalThreshold] = useState(threshold ?? 250)
  const [localZone, setLocalZone] = useState(zone ?? 'US-CAL-CISO')
  const [email, setEmail] = useState('')
  const [refresh, setRefresh] = useState('30')
  const [toast, setToast] = useState(false)

  function save() {
    setToast(true)
    setTimeout(() => setToast(false), 2200)
  }

  return (
    <>
      {/* Company theme */}
      <div className="card mb16">
        <div className="card-label">Company Theme</div>
        <div className="theme-grid">
          <button className={`theme-btn ${tweaks.scheme === 'aws' ? 'active' : ''}`}
            onClick={() => setTweaks(t => ({ ...t, scheme: 'aws' }))}>
            <div className="theme-dot-aws" />
            AWS
          </button>
          <button className={`theme-btn ${tweaks.scheme === 'google' ? 'active' : ''}`}
            onClick={() => setTweaks(t => ({ ...t, scheme: 'google' }))}>
            <div className="theme-dot-google">
              <span style={{ background: '#4285f4' }} />
              <span style={{ background: '#ea4335' }} />
              <span style={{ background: '#fbbc05' }} />
              <span style={{ background: '#34a853' }} />
            </div>
            Google
          </button>
          <button className={`theme-btn ${tweaks.scheme === 'forest' ? 'active' : ''}`}
            onClick={() => setTweaks(t => ({ ...t, scheme: 'forest' }))}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#52b788' }} />
            Forest
          </button>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-label">Scheduler Settings</div>
        <div className="settings-grid">
          <div className="field">
            <label>Grid Zone</label>
            <input value={localZone} onChange={e => setLocalZone(e.target.value)} />
          </div>
          <div className="field">
            <label>Notification Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com" />
          </div>
          <div className="field">
            <label>Green Threshold · <span className="range-value">{localThreshold} gCO₂/kWh</span></label>
            <input type="range" min="0" max="600" value={localThreshold}
              onChange={e => setLocalThreshold(Number(e.target.value))} />
          </div>
          <div className="field">
            <label>Refresh Interval</label>
            <select value={refresh} onChange={e => setRefresh(e.target.value)}>
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="btn-primary" onClick={save}>Save settings</button>
        </div>
      </div>

      {toast && (
        <div className="toast">Settings saved ✓</div>
      )}
    </>
  )
}

/* ─── TweaksPanel ─── */
function TweaksPanel({ tweaks, setTweaks, onClose }) {
  return (
    <div className="tweaks-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="tweaks-title">Tweaks</div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text3)', fontSize: 16, lineHeight: 1, padding: 2,
        }}>×</button>
      </div>

      <div>
        <div className="tweaks-section-label">Color scheme</div>
        <div className="tweaks-options">
          {['forest', 'ocean', 'earth'].map(s => (
            <button key={s} className={`tweaks-opt-btn ${tweaks.scheme === s ? 'active' : ''}`}
              onClick={() => setTweaks(t => ({ ...t, scheme: s }))}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="tweaks-section-label">Gauge style</div>
        <div className="tweaks-options">
          {['arc', 'ring', 'bar'].map(s => (
            <button key={s} className={`tweaks-opt-btn ${tweaks.gaugeStyle === s ? 'active' : ''}`}
              onClick={() => setTweaks(t => ({ ...t, gaugeStyle: s }))}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── App ─── */
export default function App() {
  const [page, setPage] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tweaks, setTweaks] = useState({ scheme: 'aws', gaugeStyle: 'arc' })
  const [showTweaks, setShowTweaks] = useState(false)

  // data
  const [current, setCurrent] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [summary, setSummary] = useState(null)
  const [powerBreakdown, setPowerBreakdown] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  // apply scheme on mount + change
  useEffect(() => {
    applyScheme(tweaks.scheme)
  }, [tweaks.scheme])

  // data fetching
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
        setDecisions(Array.isArray(d) ? d : [])
        setSummary(s)
        setPowerBreakdown(pb)
        setLastFetch(new Date())
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load')
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  // derived state
  const intensity = current?.decision?.carbon_intensity != null
    ? Number(current.decision.carbon_intensity) : null
  const threshold = current?.threshold ?? 250
  const zone = current?.decision?.zone ?? 'US-CAL-CISO'
  const action = current?.decision?.action
  const targetVcpus = current?.decision?.batch_target_vcpus
  const lastCheckedAt = current?.decision?.sk ? new Date(current.decision.sk) : null
  const isGreen = intensity != null && intensity <= threshold

  const timelineData = useMemo(() =>
    decisions.map(d => ({
      t: new Date(d.sk).getTime(),
      intensity: Number(d.carbon_intensity),
      action: d.action,
      vcpus: Number(d.batch_target_vcpus ?? 0),
    }))
  , [decisions])

  const pageData = {
    intensity, threshold, zone, action, targetVcpus, lastCheckedAt, isGreen,
    decisions, timelineData, summary, powerBreakdown,
    gaugeStyle: tweaks.gaugeStyle,
  }

  const PAGE_TITLE = { overview: 'Overview', timeline: 'Timeline', reports: 'Reports', settings: 'Settings' }

  return (
    <div className="shell">
      {/* Sidebar */}
      <div className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(v => !v)}>
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        <div className="sidebar-brand">
          {sidebarCollapsed ? (
            <CloudLogo size={32} />
          ) : (
            <div className="sidebar-brand-col">
              <div className="brand-name">Nimbus</div>
              <div className="brand-sub">Carbon-aware scheduler</div>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${page === item.id ? ' active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon-wrap"><item.Icon /></span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-zone">{zone}</div>
          <div className="sidebar-status">
            <span className="sidebar-dot"
              style={{ background: isGreen ? 'var(--green)' : 'var(--red)' }} />
            {!sidebarCollapsed && (
              <span>{isGreen ? 'Green · Running' : 'Dirty · Paused'}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`main-content${sidebarCollapsed ? ' collapsed' : ''}`}>
        {/* Page header */}
        <div className="page-header">
          <div className="page-title">{PAGE_TITLE[page]}</div>
          <div className="page-header-right">
            <div className="live-badge">
              <span className="live-dot" />
              {lastFetch
                ? lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Loading…'}
            </div>
            <button className="toolbar-btn" onClick={() => setShowTweaks(v => !v)}>
              <IconTweaks /> Tweaks
            </button>
          </div>
        </div>

        {/* Page body */}
        <div className="page-body">
          {error && <div className="error-bar">Connection error: {error}</div>}

          {page === 'overview'  && <OverviewPage  data={pageData} />}
          {page === 'timeline'  && <TimelinePage  data={pageData} />}
          {page === 'reports'   && <ReportsPage   data={pageData} />}
          {page === 'settings'  && (
            <SettingsPage tweaks={tweaks} setTweaks={setTweaks}
              threshold={threshold} zone={zone} />
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <span>AWS Lambda · Batch · DynamoDB · Bedrock · CloudFront</span>
          <span>Cloud Hacks 2026</span>
        </div>
      </div>

      {/* Tweaks panel */}
      {showTweaks && (
        <TweaksPanel tweaks={tweaks} setTweaks={setTweaks}
          onClose={() => setShowTweaks(false)} />
      )}

      {/* Floating chat */}
      <AskEcoShift />
    </div>
  )
}
