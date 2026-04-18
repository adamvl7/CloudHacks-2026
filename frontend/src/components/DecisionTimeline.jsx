import React, { useMemo } from 'react'
import {
  ComposedChart, Line, Area, ReferenceLine, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const TICK_FONT = { fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fill: '#6b6f66', letterSpacing: '0.08em' }

function TooltipCard({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div style={{
      background: '#0f1210',
      border: '1px solid #2a2f2a',
      borderRadius: 6,
      padding: '10px 14px',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 11,
      color: '#ebe9e0',
      minWidth: 140,
    }}>
      <div style={{ color: '#6b6f66', textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 10, marginBottom: 6 }}>
        {p.label}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ color: '#9ac78a' }}>intensity</span>
        <span>{Math.round(p.intensity)} g</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 4 }}>
        <span style={{ color: '#6b6f66' }}>vCPUs</span>
        <span>{p.runningVcpus}</span>
      </div>
    </div>
  )
}

export default function DecisionTimeline({ decisions, threshold = 250 }) {
  const data = useMemo(() => decisions.map(d => ({
    t: new Date(d.sk).getTime(),
    label: new Date(d.sk).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    intensity: Number(d.carbon_intensity),
    runningVcpus: d.action === 'scale_up' ? Number(d.batch_target_vcpus || 0) : 0,
  })), [decisions])

  if (!data.length) {
    return <div className="loader">Waiting for scheduler decisions…</div>
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 20, right: 24, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="intensityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ac78a" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#9ac78a" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="vcpuFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9ac78a" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#9ac78a" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="#1e221e" strokeDasharray="0" vertical={false} />

        <XAxis
          dataKey="label"
          interval={Math.max(Math.floor(data.length / 6), 1)}
          stroke="#2a2f2a"
          tickLine={false}
          axisLine={{ stroke: '#2a2f2a' }}
          tick={TICK_FONT}
          tickMargin={10}
        />
        <YAxis
          yAxisId="co2"
          stroke="#2a2f2a"
          tickLine={false}
          axisLine={false}
          tick={TICK_FONT}
          tickMargin={8}
          domain={[0, (max) => Math.max(600, Math.ceil(max / 100) * 100)]}
          ticks={[0, 150, 300, 450, 600]}
        />
        <YAxis
          yAxisId="vcpu"
          orientation="right"
          stroke="#2a2f2a"
          tickLine={false}
          axisLine={false}
          tick={{ ...TICK_FONT, fill: '#6b8e5a' }}
          tickMargin={8}
          domain={[0, 'dataMax + 4']}
        />

        <Tooltip content={<TooltipCard />} cursor={{ stroke: '#2a2f2a', strokeWidth: 1 }} />

        <ReferenceLine
          yAxisId="co2"
          y={threshold}
          stroke="#d4a54c"
          strokeDasharray="3 4"
          strokeOpacity={0.7}
        />

        <Area
          yAxisId="vcpu"
          type="stepAfter"
          dataKey="runningVcpus"
          stroke="#6b8e5a"
          strokeWidth={1}
          fill="url(#vcpuFill)"
        />
        <Area
          yAxisId="co2"
          type="monotone"
          dataKey="intensity"
          stroke="none"
          fill="url(#intensityFill)"
        />
        <Line
          yAxisId="co2"
          type="monotone"
          dataKey="intensity"
          stroke="#9ac78a"
          strokeWidth={1.75}
          dot={false}
          activeDot={{ r: 4, fill: '#9ac78a', stroke: '#0b0d0b', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
