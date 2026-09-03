import { Activity, RotateCw, Plus } from 'lucide-react'

interface HeaderProps {
  processingCount: number
  loading: boolean
  onRefresh: () => void
  onOpenUpload: () => void
}

export function Header({
  processingCount,
  loading,
  onRefresh,
  onOpenUpload,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo" aria-hidden="true">
          <Activity size={20} strokeWidth={2.2} />
        </div>
        <div className="header-titles">
          <div className="header-name-row">
            <h1>ClinicWorks</h1>
            <span className="header-tag">Platform</span>
          </div>
          <p>Clinical Document & Measurement Extraction</p>
        </div>
      </div>

      <div className="header-actions">
        {processingCount > 0 && (
          <div className="processing-indicator">
            <span className="indicator-dot" />
            <span>{processingCount} processing</span>
          </div>
        )}

        <button
          id="btn-refresh"
          className="btn btn-secondary btn-sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh document list"
        >
          <RotateCw
            size={14}
            className={`icon-svg ${loading ? 'icon-spin' : ''}`}
          />
          <span>Refresh</span>
        </button>

        <button
          id="btn-open-upload"
          className="btn btn-primary btn-sm"
          onClick={onOpenUpload}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>Upload Document</span>
        </button>
      </div>
    </header>
  )
}
