import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import type { Document } from './services/api'
import { fetchDocuments, retryDocument } from './services/api'
import { Header } from './components/Header'
import { StatsOverview } from './components/StatsOverview'
import { DocumentsTable } from './components/DocumentsTable'
import { UploadModal } from './components/UploadModal'
import './index.css'

const POLL_INTERVAL_MS = 5000 // refresh every 5s while any doc is PROCESSING

export default function App() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadDocs = useCallback(async () => {
    try {
      const data = await fetchDocuments()
      setDocs(data)
      setFetchError(null)
    } catch (err) {
      setFetchError((err as Error).message)
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  // Start / stop polling based on whether any doc is still PROCESSING
  useEffect(() => {
    const hasProcessing = docs.some(d => d.processing_status === 'PROCESSING')

    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(loadDocs, POLL_INTERVAL_MS)
    }
    if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [docs, loadDocs])

  // Initial load
  useEffect(() => {
    let ignore = false

    fetchDocuments()
      .then(data => {
        if (!ignore) {
          setDocs(data)
          setFetchError(null)
        }
      })
      .catch((err: Error) => {
        if (!ignore) {
          setFetchError(err.message)
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingDocs(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [])

  function handleUploaded(doc: Document) {
    // Prepend the new document immediately
    setDocs(prev => [doc, ...prev])
  }

  async function handleRetry(id: string) {
    setRetryingId(id)
    try {
      const updated = await retryDocument(id)
      setDocs(prev => prev.map(d => (d.id === id ? updated : d)))
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setRetryingId(null)
    }
  }

  const processingCount = docs.filter(d => d.processing_status === 'PROCESSING').length

  return (
    <div className="app-container">
      <div className="layout">
        <Header
          processingCount={processingCount}
          loading={loadingDocs}
          onRefresh={loadDocs}
          onOpenUpload={() => setIsUploadModalOpen(true)}
        />

        <main className="main-content">
          <StatsOverview docs={docs} />

          {fetchError && (
            <div id="fetch-error" className="feedback feedback-error" style={{ marginBottom: 20 }}>
              <AlertCircle size={18} />
              <span>Failed to load documents: {fetchError}</span>
            </div>
          )}

          <DocumentsTable
            docs={docs}
            loading={loadingDocs}
            onRetry={handleRetry}
            retryingId={retryingId}
            onOpenUpload={() => setIsUploadModalOpen(true)}
          />
        </main>

        {isUploadModalOpen && (
          <UploadModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            onUploaded={handleUploaded}
          />
        )}
      </div>
    </div>
  )
}
