import { FileText, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react'
import type { Document } from '../services/api'

interface StatsOverviewProps {
  docs: Document[]
}

export function StatsOverview({ docs }: StatsOverviewProps) {
  const total = docs.length
  const successCount = docs.filter(d => d.processing_status === 'SUCCESS').length
  const needsReviewCount = docs.filter(d => d.processing_status === 'NEEDS_REVIEW').length
  const processingCount = docs.filter(d => d.processing_status === 'PROCESSING').length
  const failedCount = docs.filter(d => d.processing_status === 'FAILED').length

  const avgConfidence = (() => {
    const withScore = docs.filter(d => d.confidence_score !== null)
    if (withScore.length === 0) return null
    const sum = withScore.reduce((acc, curr) => acc + (curr.confidence_score ?? 0), 0)
    return Math.round((sum / withScore.length) * 100)
  })()

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Total Documents</span>
          <span className="stat-icon-badge">
            <FileText size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="stat-value">{total}</div>
        <div className="stat-sub">
          {processingCount > 0 ? (
            <span style={{ color: 'var(--blue)' }}>{processingCount} actively extracting</span>
          ) : (
            <span>All processed or reviewed</span>
          )}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Successful</span>
          <span className="stat-icon-badge stat-icon-success">
            <CheckCircle2 size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="stat-value">{successCount}</div>
        <div className="stat-sub">
          {total > 0 ? `${Math.round((successCount / total) * 100)}% extraction rate` : 'No data yet'}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Needs Review</span>
          <span className="stat-icon-badge stat-icon-review">
            <AlertCircle size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="stat-value">{needsReviewCount}</div>
        <div className="stat-sub">
          {failedCount > 0 ? (
            <span style={{ color: 'var(--red)' }}>{failedCount} failed</span>
          ) : (
            <span>0 extraction errors</span>
          )}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-header">
          <span className="stat-label">Avg Confidence</span>
          <span className="stat-icon-badge stat-icon-primary">
            <TrendingUp size={15} strokeWidth={2} />
          </span>
        </div>
        <div className="stat-value">
          {avgConfidence !== null ? `${avgConfidence}%` : '—'}
        </div>
        <div className="stat-sub">
          {avgConfidence !== null && avgConfidence >= 80 ? 'High extraction accuracy' : 'Model certainty'}
        </div>
      </div>
    </div>
  )
}
