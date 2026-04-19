import React, { useEffect, useMemo, useState } from 'react'
import GaugeMeter from './components/GaugeMeter.jsx'
import TimelineChart from './components/TimelineChart.jsx'
import SavingsCard from './components/SavingsCard.jsx'
import BatchStateCard from './components/BatchStateCard.jsx'
import DecisionCounts from './components/DecisionCounts.jsx'
import PowerBreakdown from './components/PowerBreakdown.jsx'
import ForecastStrip from './components/ForecastStrip.jsx'
import RegionCompareBanner from './components/RegionCompareBanner.jsx'
import {
  getLatestSummary,
  generateSummary,
  getRegions,
  getGridCurrent,
  getGridHistory,
  getPowerBreakdown,
  getForecast,
  getRegionCompare,
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
    '--sb-title':'#232f3e','--sb-sub':'rgba(0,0,0,0.3)',
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
const DEFAULT_REGION = 'us-west-2'
const REGION_STORAGE_KEY = 'ecoshift:selected-region'
const FALLBACK_REGION_OPTIONS = [
  { region: 'us-east-1', name: 'N. Virginia', label: 'us-east-1 - N. Virginia', zone: 'US-MIDA-PJM', threshold: 350 },
  { region: 'us-east-2', name: 'Ohio', label: 'us-east-2 - Ohio', zone: 'US-MIDW-MISO', threshold: 380 },
  { region: 'us-west-2', name: 'Oregon', label: 'us-west-2 - Oregon', zone: 'US-NW-BPAT', threshold: 120 },
  { region: 'us-west-1', name: 'N. California', label: 'us-west-1 - N. California', zone: 'US-CAL-CISO', threshold: 200 },
]

function getInitialRegion() {
  try {
    const stored = window.localStorage.getItem(REGION_STORAGE_KEY)
    if (FALLBACK_REGION_OPTIONS.some(r => r.region === stored)) return stored
  } catch {
    // localStorage can be blocked; defaulting keeps the dashboard usable.
  }
  return DEFAULT_REGION
}

function formatRegionOption(region) {
  if (!region) return 'us-west-2 - Oregon - US-NW-BPAT - 120 gCO2/kWh'
  return `${region.region} - ${region.name} - ${region.zone} - ${region.threshold} gCO2/kWh`
}

function normalizeHistoryPoint(point) {
  const datetime = point.datetime || point.time || point.sk
  const intensity = Number(point.carbonIntensity ?? point.carbon_intensity)
  if (!datetime || !Number.isFinite(intensity)) return null
  return {
    sk: datetime,
    carbon_intensity: intensity,
    action: point.action,
    batch_target_vcpus: Number(point.batch_target_vcpus ?? 0),
  }
}

function nextUtcMidnight(from = new Date()) {
  return new Date(Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate() + 1,
    0, 0, 0, 0
  ))
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/* ─── Pages ─── */
function OverviewPage({ data }) {
  const { intensity, threshold, zone, selectedRegionOption, action, targetVcpus, lastCheckedAt,
          decisions, timelineData, summary, powerBreakdown, forecast, regionCompare,
          gaugeStyle } = data

  return (
    <>
      <RegionCompareBanner data={regionCompare} />
      <div className="grid g4 mb16">
        <div className="card">
          <div className="card-label">Grid Intensity</div>
          <GaugeMeter intensity={intensity} threshold={threshold} gaugeStyle={gaugeStyle} />
          <div className="region-meta">{formatRegionOption(selectedRegionOption)}</div>
        </div>
        <div className="card">
          <div className="card-label">Shift Recommendation</div>
          <BatchStateCard action={action} vcpus={targetVcpus} checkedAt={lastCheckedAt} />
        </div>
        <div className="card">
          <div className="card-label">Preview Savings - Last 24h</div>
          <SavingsCard decisions={decisions} summary={null} />
        </div>
        <div className="card">
          <div className="card-label">Preview Counts - 24h</div>
          <DecisionCounts decisions={decisions} />
        </div>
      </div>

      <div className="card mb16">
        <div className="card-label">Next 24h Forecast - {zone}</div>
        <ForecastStrip data={forecast} />
      </div>

      <div className="card mb16">
        <div className="card-label">Selected Region Timeline - 24h</div>
        <TimelineChart data={timelineData} threshold={threshold} />
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="card-label">Energy Mix · {zone}</div>
          <PowerBreakdown data={powerBreakdown} />
        </div>
        <div className="card">
          <div className="card-label">Bedrock Sustainability Report</div>
          <p className="report-narrative report-preview">
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
  const { decisions, timelineData, threshold, zone, selectedRegionOption } = data
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
          <div className="card-label">Preview Decisions</div>
          <div className="stat-value">{total}</div>
          <div className="stat-label">last 24h</div>
        </div>
        <div className="card">
          <div className="card-label">Runnable Share</div>
          <div className="stat-value" style={{ color: 'var(--green)' }}>
            {cleanShare != null ? `${cleanShare}%` : '—'}
          </div>
          <div className="stat-label">would run</div>
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
        <div className="card-label">Selected Region Timeline - 24h</div>
        <TimelineChart data={timelineData} threshold={threshold} />
      </div>

      <div className="card">
        <div className="card-label">Preview Decision Log - {zone}</div>
        <div className="region-meta" style={{ textAlign: 'left' }}>{formatRegionOption(selectedRegionOption)}</div>
        {decisions.length === 0 ? (
          <div className="loader-text">No region history loaded yet</div>
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
  const { summary, setSummary } = data
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateError('')
    try {
      const report = await generateSummary()
      setSummary(report)
      setExpanded(true)
    } catch (e) {
      setGenerateError(e?.response?.data?.error || e.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const nextReportAt = nextUtcMidnight(now)
  const countdown = formatCountdown(nextReportAt.getTime() - now.getTime())
  const nextReportTime = nextReportAt.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  })
  const reportType = summary?.report_type === 'manual_rolling_24h'
    ? 'Rolling previous 24 hours'
    : 'Previous UTC day'

  const m = summary?.metrics || {}
  const date = summary?.date || summary?.sk || 'No report yet'
  const gco2 = m.gco2_avoided
  const hoursShifted = m.hours_shifted ?? m.vcpu_hours_run
  const cleanPct = m.clean_pct ?? m.clean_share

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="report-card">
        <div className="report-toolbar">
          <div className="report-timer">
            <span>Next daily report</span>
            <strong>{countdown}</strong>
            <span>{nextReportTime}</span>
          </div>
          <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate report'}
          </button>
        </div>
        {generateError && <div className="error-bar">{generateError}</div>}

        <div className="report-date">{date}</div>
        <div className="narrative-byline">{reportType}</div>
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
        {!summary ? (
          <div className="loader-text">No reports generated yet</div>
        ) : summary.narrative && (
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

function SettingsPage({ tweaks, setTweaks, zone }) {
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


/* ─── App ─── */
export default function App() {
  const [page, setPage] = useState('overview')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [tweaks, setTweaks] = useState({ scheme: 'aws' })

  // data
  const [summary, setSummary] = useState(null)
  const [regionOptions, setRegionOptions] = useState(FALLBACK_REGION_OPTIONS)
  const [selectedRegion, setSelectedRegion] = useState(getInitialRegion)
  const [gridCurrent, setGridCurrent] = useState(null)
  const [regionalHistory, setRegionalHistory] = useState(null)
  const [powerBreakdown, setPowerBreakdown] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [regionCompare, setRegionCompare] = useState(null)
  const [error, setError] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

  // apply scheme on mount + change
  useEffect(() => {
    applyScheme(tweaks.scheme)
  }, [tweaks.scheme])

  useEffect(() => {
    let cancelled = false
    async function loadRegions() {
      try {
        const data = await getRegions()
        if (cancelled || !Array.isArray(data?.regions) || data.regions.length === 0) return
        setRegionOptions(data.regions)
        if (!data.regions.some(r => r.region === selectedRegion)) {
          setSelectedRegion(data.default_region || DEFAULT_REGION)
        }
      } catch {
        // The static fallback exactly mirrors the backend options.
      }
    }
    loadRegions()
    return () => { cancelled = true }
  }, [selectedRegion])

  useEffect(() => {
    try {
      window.localStorage.setItem(REGION_STORAGE_KEY, selectedRegion)
    } catch {
      // Ignore storage failures; the dropdown still works for this session.
    }
  }, [selectedRegion])

  // data fetching
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, gc, gh, pb, fc, rc] = await Promise.all([
          getLatestSummary().catch(() => null),
          getGridCurrent(selectedRegion).catch(() => null),
          getGridHistory(selectedRegion).catch(() => null),
          getPowerBreakdown(selectedRegion).catch(() => null),
          getForecast(selectedRegion).catch(() => null),
          getRegionCompare(selectedRegion).catch(() => null),
        ])
        if (cancelled) return
        setSummary(s)
        setGridCurrent(gc)
        setRegionalHistory(gh)
        setPowerBreakdown(pb)
        setForecast(fc)
        setRegionCompare(rc)
        setLastFetch(new Date())
        setError(null)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load')
      }
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [selectedRegion])

  // derived state
  const selectedRegionOption = regionOptions.find(r => r.region === selectedRegion)
    || FALLBACK_REGION_OPTIONS.find(r => r.region === selectedRegion)
    || FALLBACK_REGION_OPTIONS.find(r => r.region === DEFAULT_REGION)
  const intensity = gridCurrent?.carbonIntensity != null
    ? Number(gridCurrent.carbonIntensity) : null
  const threshold = gridCurrent?.threshold ?? selectedRegionOption?.threshold ?? 250
  const zone = gridCurrent?.zone ?? selectedRegionOption?.zone ?? 'US-NW-BPAT'
  const isGreen = intensity != null && intensity <= threshold
  const regionalDecisions = useMemo(() => {
    const raw = Array.isArray(regionalHistory?.history) ? regionalHistory.history : []
    return raw.map(normalizeHistoryPoint).filter(Boolean)
  }, [regionalHistory])
  const latestRegionalDecision = regionalDecisions[regionalDecisions.length - 1] || null
  const action = latestRegionalDecision?.action || (isGreen ? 'scale_up' : intensity == null ? null : 'scale_down')
  const targetVcpus = latestRegionalDecision?.batch_target_vcpus
  const lastCheckedAt = latestRegionalDecision?.sk
    ? new Date(latestRegionalDecision.sk)
    : gridCurrent?.datetime ? new Date(gridCurrent.datetime) : null

  const timelineData = useMemo(() =>
    regionalDecisions.map(d => ({
      t: new Date(d.sk).getTime(),
      intensity: Number(d.carbon_intensity),
      action: d.action,
      vcpus: Number(d.batch_target_vcpus ?? 0),
    }))
  , [regionalDecisions])

  const pageData = {
    intensity, threshold, zone, action, targetVcpus, lastCheckedAt, isGreen,
    decisions: regionalDecisions, timelineData, summary, setSummary, powerBreakdown, forecast, regionCompare,
    selectedRegionOption,
    gaugeStyle: 'arc',
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
            <CloudLogo size={42} />
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
              <span>{isGreen ? 'Green preview' : 'Dirty preview'}</span>
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
            <label className="region-select-wrap">
              <span>Region</span>
              <select
                value={selectedRegion}
                onChange={e => setSelectedRegion(e.target.value)}
                aria-label="Select dashboard region"
              >
                {regionOptions.map(region => (
                  <option key={region.region} value={region.region}>
                    {formatRegionOption(region)}
                  </option>
                ))}
              </select>
            </label>
            <div className="live-badge">
              <span className="live-dot" />
              {lastFetch
                ? lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Loading…'}
            </div>
          </div>
        </div>

        {/* Page body */}
        <div className="page-body">
          {error && <div className="error-bar">Connection error: {error}</div>}

          {page === 'overview'  && <OverviewPage  data={pageData} />}
          {page === 'timeline'  && <TimelinePage  data={pageData} />}
          {page === 'reports'   && <ReportsPage   data={pageData} />}
          {page === 'settings'  && (
            <SettingsPage tweaks={tweaks} setTweaks={setTweaks} zone={zone} />
          )}
        </div>

        {/* Footer */}
        <div className="footer">
          <span>AWS Lambda · Batch · DynamoDB · Bedrock · CloudFront</span>
          <span>Cloud Hacks 2026</span>
        </div>
      </div>

    </div>
  )
}
