import React, { useMemo } from 'react'
import {
  ComposedChart, Line, Area, ReferenceLine, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

export default function DecisionTimeline({ decisions, threshold = 250 }) {
  const data = useMemo(() => decisions.map(d => ({
    t: new Date(d.sk).getTime(),
    label: new Date(d.sk).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    intensity: Number(d.carbon_intensity),
    runningVcpus: d.action === 'scale_up' ? Number(d.batch_target_vcpus || 0) : 0,
  })), [decisions])

  if (!data.length) {
    return <div className="loader">Waiting for scheduler decisions — first tick lands within 15 minutes of deploy.</div>
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#1e3328" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          interval={Math.max(Math.floor(data.length / 8), 1)}
          stroke="#8fa49a"
          tick={{ fontSize: 11 }}
        />
        <YAxis
          yAxisId="co2"
          stroke="#8fa49a"
          tick={{ fontSize: 11 }}
          label={{ value: 'gCO₂/kWh', angle: -90, position: 'insideLeft', style: { fill: '#8fa49a', fontSize: 11 } }}
        />
        <YAxis
          yAxisId="vcpu"
          orientation="right"
          stroke="#4ade80"
          tick={{ fontSize: 11 }}
          label={{ value: 'vCPUs', angle: 90, position: 'insideRight', style: { fill: '#4ade80', fontSize: 11 } }}
        />
        <Tooltip
          contentStyle={{ background: '#12201a', border: '1px solid #1e3328', borderRadius: 8 }}
          labelStyle={{ color: '#e8f2ec' }}
        />
        <ReferenceLine yAxisId="co2" y={threshold} stroke="#fbbf24" strokeDasharray="4 4"
                       label={{ value: `threshold ${threshold}`, position: 'insideTopRight', fill: '#fbbf24', fontSize: 11 }} />
        <Area yAxisId="vcpu" type="stepAfter" dataKey="runningVcpus" stroke="none" fill="#4ade80" fillOpacity={0.18} />
        <Line yAxisId="co2" type="monotone" dataKey="intensity" stroke="#34d399" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
