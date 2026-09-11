import { useState, useMemo } from 'react'
import { Search, X, FolderOpen, FileText, RotateCw, AlertCircle, User as UserIcon } from 'lucide-react'
import type { Document, ProcessingStatus } from '../services/api'
import { StatusBadge } from './StatusBadge'
import { ConfidenceBar } from './ConfidenceBar'

interface DocumentsTableProps {
  docs: Document[]
  loading: boolean
  onRetry: (id: string) => void
  retryingId: string | null
  onOpenUpload: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getShortErrorMessage(msg: string): string {
  if (msg.includes('Could not categorize') || msg.includes('Blood Pressure or HbA1c')) {
    return 'Unrecognized measure'
  }
  if (msg.includes('under 18')) return 'Patient under 18'
  if (msg.includes('No valid current blood pressure') || msg.includes('missing systolic')) {
    return 'No valid BP found'
  }
  if (msg.includes('No valid HbA1c')) return 'No valid HbA1c'
  if (msg.includes('no extractable text')) return 'No text found'
  if (msg.includes('no blob_name')) return 'Missing file blob'
  if (msg.length > 25) return msg.slice(0, 23) + '…'
  return msg
}

export function DocumentsTable({
  docs,
  loading,
  onRetry,
  retryingId,
  onOpenUpload,
}: DocumentsTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchesSearch =
        search.trim() === '' ||
        doc.file_name.toLowerCase().includes(search.toLowerCase()) ||
        (doc.measure && doc.measure.toLowerCase().includes(search.toLowerCase())) ||
        (doc.document_type && doc.document_type.toLowerCase().includes(search.toLowerCase())) ||
        (doc.processed_by && doc.processed_by.toLowerCase().includes(search.toLowerCase()))

      const matchesStatus =
        statusFilter === 'ALL' || doc.processing_status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [docs, search, statusFilter])

  return (
    <div className="table-card">
      {/* Table Toolbar */}
      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <Search className="search-icon" size={15} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by filename, measure, type or processed by…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search documents"
            />
            {search && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="status-filters">
            {(['ALL', 'PROCESSING', 'SUCCESS', 'NEEDS_REVIEW', 'FAILED'] as const).map(tab => {
              const count =
                tab === 'ALL'
                  ? docs.length
                  : docs.filter(d => d.processing_status === tab).length

              return (
                <button
                  key={tab}
                  type="button"
                  className={`filter-chip ${statusFilter === tab ? 'active' : ''}`}
                  onClick={() => setStatusFilter(tab)}
                >
                  <span>{tab === 'ALL' ? 'All' : tab.replace('_', ' ')}</span>
                  <span className="chip-count">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="toolbar-right">
          <span className="doc-count">
            {filteredDocs.length} {filteredDocs.length === 1 ? 'record' : 'records'}
          </span>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="table-wrap">
          <div className="table-loading">
            <span className="spinner-primary" />
            <span>Loading documents…</span>
          </div>
        </div>
      ) : docs.length === 0 ? (
        <div className="table-wrap">
          <div className="table-empty">
            <div className="empty-icon-wrap">
              <FolderOpen size={32} strokeWidth={1.6} />
            </div>
            <h3>No documents uploaded yet</h3>
            <p>Upload a clinical PDF to automatically extract BP or HbA1c values.</p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenUpload}
              style={{ marginTop: 14 }}
            >
              Upload Document
            </button>
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="table-wrap">
          <div className="table-empty" style={{ padding: '40px 20px' }}>
            <p style={{ fontWeight: 500 }}>No documents match the current filter</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('')
                setStatusFilter('ALL')
              }}
              style={{ marginTop: 12 }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap" id="documents-table">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Measure</th>
                <th>Measure Date</th>
                <th>Date Processed</th>
                <th>Processed By</th>
                <th>Status</th>
                <th>Confidence</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => (
                <tr key={doc.id} id={`doc-row-${doc.id}`}>
                  {/* Filename */}
                  <td>
                    <div className="cell-doc-info">
                      <div className="doc-icon-mini">
                        <FileText size={15} strokeWidth={2} />
                      </div>
                      <div
                        className="cell-filename"
                        data-tooltip={doc.file_name}
                        title={doc.file_name}
                      >
                        {doc.file_name}
                      </div>
                    </div>
                  </td>

                  {/* Document type */}
                  <td>
                    {doc.document_type ? (
                      <span
                        className={`type-tag ${
                          doc.document_type === 'BP' ? 'type-tag-bp' : 'type-tag-other'
                        }`}
                      >
                        {doc.document_type}
                      </span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>

                  {/* Measure */}
                  <td>
                    {doc.measure ? (
                      <span className="cell-measure">{doc.measure}</span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>

                  {/* Measure date */}
                  <td className="cell-muted">{formatDate(doc.measure_date)}</td>

                  {/* Date processed */}
                  <td className="cell-muted">
                    {doc.date_processed ? formatDateTime(doc.date_processed) : formatDateTime(doc.created_at)}
                  </td>

                  {/* Processed By */}
                  <td>
                    <span className="cell-processed-by" title={doc.processed_by || 'User'}>
                      <UserIcon size={12} strokeWidth={2} />
                      <span>{doc.processed_by || 'User'}</span>
                    </span>
                  </td>

                  {/* Status + error */}
                  <td>
                    <div className="status-cell-wrap">
                      <div className="status-badge-row">
                        <StatusBadge status={doc.processing_status as ProcessingStatus} />
                        {doc.error_message && (
                          <span
                            className="status-error-icon"
                            data-tooltip={doc.error_message}
                            title={doc.error_message}
                          >
                            <AlertCircle size={14} />
                          </span>
                        )}
                      </div>
                      {doc.error_message && (
                        <div
                          className="error-message"
                          data-tooltip={doc.error_message}
                          title={doc.error_message}
                        >
                          {getShortErrorMessage(doc.error_message)}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Confidence */}
                  <td>
                    <ConfidenceBar score={doc.confidence_score} />
                  </td>

                  {/* Actions */}
                  <td style={{ textAlign: 'right' }}>
                    {doc.processing_status === 'FAILED' ? (
                      <button
                        id={`btn-retry-${doc.id}`}
                        className="btn btn-retry"
                        onClick={() => onRetry(doc.id)}
                        disabled={retryingId === doc.id}
                        aria-label={`Retry processing for ${doc.file_name}`}
                      >
                        {retryingId === doc.id ? (
                          <>
                            <span className="spinner-primary" style={{ width: 12, height: 12 }} />
                            <span>Retrying…</span>
                          </>
                        ) : (
                          <>
                            <RotateCw size={12} strokeWidth={2.2} />
                            <span>Retry</span>
                          </>
                        )}
                      </button>
                    ) : doc.processing_status === 'PROCESSING' ? (
                      <span className="cell-muted" style={{ fontSize: 12 }}>
                        Processing…
                      </span>
                    ) : (
                      <span className="cell-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
