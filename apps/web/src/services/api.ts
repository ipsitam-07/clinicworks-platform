export type ProcessingStatus = 'PROCESSING' | 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED'

export interface Document {
  id: string
  file_name: string
  blob_name: string | null
  blob_url: string | null
  document_type: string | null
  measure: string | null
  measure_date: string | null
  date_processed: string | null
  processed_by: string | null
  processing_status: ProcessingStatus
  error_message: string | null
  confidence_score: number | null
  created_at: string
  updated_at: string
}

// API calls

const BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  const body = await res.json()
  if (!res.ok) {
    throw new Error(body.message ?? `HTTP ${res.status}`)
  }
  return body as T
}

/** Fetch all documents, newest first */
export async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch(`${BASE}/documents`)
  const body = await handleResponse<{ documents: Document[] }>(res)
  return body.documents
}

/** Fetch a single document by ID */
export async function fetchDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}`)
  const body = await handleResponse<{ document: Document }>(res)
  return body.document
}

/** Upload a PDF file — returns the created document record */
export async function uploadDocument(file: File, processedBy: string = 'User'): Promise<Document> {
  const form = new FormData()
  form.append('file', file)
  form.append('processed_by', processedBy)

  const res = await fetch(`${BASE}/documents`, {
    method: 'POST',
    body: form,
    // Do NOT set Content-Type — the browser sets it automatically with the multipart boundary
  })
  const body = await handleResponse<{ document: Document }>(res)
  return body.document
}

/** Retry a FAILED document — triggers the processing workflow again */
export async function retryDocument(id: string): Promise<Document> {
  const res = await fetch(`${BASE}/documents/${id}/retry`, { method: 'POST' })
  const body = await handleResponse<{ document: Document }>(res)
  return body.document
}
