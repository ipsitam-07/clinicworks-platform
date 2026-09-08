import type { ProcessingStatus } from '../services/api'

interface StatusBadgeProps {
  status: ProcessingStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<ProcessingStatus, { cls: string; label: string }> = {
    PROCESSING:   { cls: 'badge-processing',   label: 'Processing' },
    SUCCESS:      { cls: 'badge-success',       label: 'Success' },
    NEEDS_REVIEW: { cls: 'badge-needs-review',  label: 'Needs Review' },
    FAILED:       { cls: 'badge-failed',        label: 'Failed' },
  }

  const { cls, label } = config[status] ?? { cls: 'badge-processing', label: status }

  return (
    <span className={`badge ${cls}`}>
      <span className="badge-dot" />
      {label}
    </span>
  )
}
