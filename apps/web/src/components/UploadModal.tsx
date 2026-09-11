import { useState, useRef, useEffect, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import {
  X,
  CheckCircle2,
  UploadCloud,
  FileText,
  AlertCircle,
  Upload,
} from 'lucide-react'
import { uploadDocument, type Document } from '../services/api'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploaded: (doc: Document) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadModal({ isOpen, onClose, onUploaded }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [processedBy, setProcessedBy] = useState('User')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setFile(null)
    setProcessedBy('User')
    setDragging(false)
    setUploading(false)
    setResult(null)
  }, [])

  const handleCloseSafe = useCallback(() => {
    if (uploading) return
    resetState()
    onClose()
  }, [uploading, resetState, onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !uploading) {
        handleCloseSafe()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, uploading, handleCloseSafe])

  if (!isOpen) return null

  function handleFileSelect(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf') {
      setResult({ type: 'error', message: 'Only PDF files are accepted.' })
      return
    }
    if (f.size > 20 * 1024 * 1024) {
      setResult({ type: 'error', message: 'File exceeds the 20 MB limit.' })
      return
    }
    setFile(f)
    setResult(null)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFileSelect(e.target.files?.[0] ?? null)
    e.target.value = '' // allow re-selecting the same file
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    handleFileSelect(e.dataTransfer.files?.[0] ?? null)
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const doc = await uploadDocument(file, processedBy.trim() || 'User')
      setResult({
        type: 'success',
        message: `"${doc.file_name}" uploaded successfully. Processing started.`,
      })
      setFile(null)
      onUploaded(doc)
    } catch (err) {
      setResult({ type: 'error', message: (err as Error).message })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleCloseSafe} role="dialog" aria-modal="true">
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Upload Clinical Document</h2>
            <p className="modal-subtitle">
              Upload a patient medical report (PDF) to extract clinical measurements like BP and HbA1c.
            </p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleCloseSafe}
            disabled={uploading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body">
          {result?.type === 'success' ? (
            <div className="upload-complete-box">
              <div className="complete-icon">
                <CheckCircle2 size={28} color="#059669" strokeWidth={2.2} />
              </div>
              <h3>Document Submitted!</h3>
              <p>{result.message}</p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setResult(null)}
                >
                  Upload Another File
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCloseSafe}
                >
                  View in Table
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                id="drop-zone"
                className={`drop-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={e => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  id="file-input"
                  type="file"
                  accept="application/pdf"
                  onChange={onInputChange}
                  aria-label="Select PDF file"
                />
                <div className="drop-icon-wrap">
                  <UploadCloud size={24} strokeWidth={2} />
                </div>
                <p className="drop-title">
                  Click to browse or drag and drop your PDF
                </p>
                <p className="drop-hint">PDF format only &bull; Up to 20 MB</p>
              </div>

              {file && (
                <div className="file-selected">
                  <div className="file-icon">
                    <FileText size={18} strokeWidth={2} />
                  </div>
                  <div className="file-meta">
                    <span className="file-name" title={file.name}>{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                  <button
                    id="btn-clear-file"
                    className="btn-clear"
                    aria-label="Remove selected file"
                    onClick={() => setFile(null)}
                    disabled={uploading}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <div className="upload-input-group">
                <label htmlFor="processed-by-input" className="input-label">
                  Processed By
                </label>
                <input
                  id="processed-by-input"
                  type="text"
                  className="text-input"
                  placeholder="e.g. User or Provider Name"
                  value={processedBy}
                  onChange={e => setProcessedBy(e.target.value)}
                  disabled={uploading}
                />
              </div>

              {result?.type === 'error' && (
                <div id="upload-error" className="feedback feedback-error">
                  <AlertCircle size={16} strokeWidth={2} />
                  <span>{result.message}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {result?.type !== 'success' && (
          <div className="modal-footer">
            <button
              id="btn-cancel"
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCloseSafe}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              id="btn-upload"
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner" />
                  <span>Processing Upload…</span>
                </>
              ) : (
                <>
                  <Upload size={14} strokeWidth={2} />
                  <span>Upload & Process</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
