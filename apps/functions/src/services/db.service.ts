import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'clinicworks',
  user: process.env.DB_USER || 'clinicworks',
  password: process.env.DB_PASSWORD || 'clinicworks_dev',
})

export interface ExtractionUpdate {
  documentType: string | null
  measure: string | null
  measureDate: string | null
  confidenceScore: number | null
  status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED'
  errorMessage?: string | null
}

export async function findDocumentById(id: string) {
  const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id])
  return res.rows[0] ?? null
}

export async function findDocumentByBlobName(blobName: string) {
  const res = await pool.query('SELECT * FROM documents WHERE blob_name = $1', [blobName])
  return res.rows[0] ?? null
}

export async function getPendingDocuments() {
  const res = await pool.query(
    "SELECT * FROM documents WHERE processing_status = 'PROCESSING' ORDER BY created_at ASC"
  )
  return res.rows
}

export async function updateDocumentResult(id: string, update: ExtractionUpdate) {
  const query = `
    UPDATE documents
    SET
      document_type = $1,
      measure = $2,
      measure_date = $3,
      confidence_score = $4,
      processing_status = $5,
      error_message = $6,
      date_processed = NOW(),
      processed_by = 'azure-function',
      updated_at = NOW()
    WHERE id = $7
    RETURNING *
  `
  const values = [
    update.documentType,
    update.measure,
    update.measureDate,
    update.confidenceScore,
    update.status,
    update.errorMessage ?? null,
    id,
  ]

  const res = await pool.query(query, values)
  return res.rows[0] ?? null
}
