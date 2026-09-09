import { Pool } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config()

const isAzure = process.env.DB_HOST && process.env.DB_HOST !== 'localhost'

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'clinicworks',
  user: process.env.DB_USER || 'clinicworks',
  password: process.env.DB_PASSWORD || 'clinicworks_dev',
  ssl: isAzure ? { rejectUnauthorized: false } : false,
})

let schemaEnsured = false
export async function ensureClaimColumnExists() {
  if (schemaEnsured) return
  try {
    await pool.query('ALTER TABLE documents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ')
    schemaEnsured = true
  } catch (err) {
    console.error('Warning: Failed to ensure claimed_at column exists:', err)
  }
}

export async function claimDocumentForProcessing(id: string, claimedBy: string = 'azure-function') {
  await ensureClaimColumnExists()
  const res = await pool.query(
    `UPDATE documents
     SET claimed_at = NOW(),
         processed_by = $2,
         updated_at = NOW()
     WHERE id = $1
       AND processing_status = 'PROCESSING'
       AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
     RETURNING *`,
    [id, claimedBy]
  )
  return res.rows[0] ?? null
}

export async function releaseDocumentClaim(id: string) {
  await pool.query(
    `UPDATE documents SET claimed_at = NULL, updated_at = NOW() WHERE id = $1`,
    [id]
  )
}

export interface ExtractionUpdate {
  documentType: string | null
  measure: string | null
  measureDate: string | null
  confidenceScore: number | null
  status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED'
  errorMessage?: string | null
  processedBy?: string | null
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
  await ensureClaimColumnExists()
  const res = await pool.query(
    `SELECT * FROM documents
     WHERE processing_status = 'PROCESSING'
       AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
     ORDER BY created_at ASC`
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
      processed_by = COALESCE($7, processed_by, 'azure-function'),
      updated_at = NOW()
    WHERE id = $8
    RETURNING *
  `
  const values = [
    update.documentType,
    update.measure,
    update.measureDate,
    update.confidenceScore,
    update.status,
    update.errorMessage ?? null,
    update.processedBy ?? 'azure-function',
    id,
  ]

  const res = await pool.query(query, values)
  return res.rows[0] ?? null
}
