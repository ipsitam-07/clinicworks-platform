interface ConfidenceBarProps {
  score: number | null
}

export function ConfidenceBar({ score }: ConfidenceBarProps) {
  if (score === null || score === undefined) {
    return <span className="cell-muted">—</span>
  }

  const pct = Math.round(score * 100)
  const cls = pct >= 80 ? 'high' : pct >= 50 ? 'mid' : 'low'

  return (
    <div className="confidence-bar" title={`Confidence: ${pct}%`}>
      <div className="confidence-track">
        <div className={`confidence-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="confidence-label">{pct}%</span>
    </div>
  )
}
