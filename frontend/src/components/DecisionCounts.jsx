import React from 'react'

export default function DecisionCounts({ decisions = [] }) {
  const green = decisions.filter(d => d.action === 'scale_up').length
  const dirty = decisions.filter(d => d.action === 'scale_down').length
  const total = green + dirty
  const cleanShare = total > 0 ? Math.round((green / total) * 100) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="dc-row">
        <div className="dc-item">
          <span className="dc-label">Green</span>
          <span className="dc-num green">{green}</span>
        </div>
        <div className="dc-item">
          <span className="dc-label">Dirty</span>
          <span className="dc-num red">{dirty}</span>
        </div>
        <div className="dc-item">
          <span className="dc-label">Clean share</span>
          <span className="dc-num neutral">
            {cleanShare != null ? `${cleanShare}%` : '—'}
          </span>
        </div>
      </div>
      {total > 0 && (
        <div className="dc-track">
          <div className="dc-green" style={{ width: `${(green / total) * 100}%` }} />
          <div className="dc-dirty" style={{ width: `${(dirty / total) * 100}%` }} />
        </div>
      )}
    </div>
  )
}
