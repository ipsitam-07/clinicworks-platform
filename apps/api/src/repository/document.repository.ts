import { pool } from "../config/db";

export interface DocumentRecord {
    id: string;
    file_name: string;
    blob_name: string | null;
    blob_url: string | null;
    document_type: string | null;
    measure: string | null;
    measure_date: string | null;
    date_processed: string | null;
    processed_by: string | null;
    processing_status: string;
    claimed_at?: string | null;
    error_message: string | null;
    confidence_score: number | null;
    created_at: string;
    updated_at: string;
}

export interface CreateDocumentInput {
    id: string;
    file_name: string;
    blob_name: string | null;
    blob_url: string | null;
    processing_status: string;
    processed_by?: string | null;
}

export interface UpdateDocumentProcessingInput {
    document_type?: string | null;
    measure?: string | null;
    measure_date?: string | null;
    date_processed?: string | null;
    processed_by?: string | null;
    processing_status: string;
    error_message?: string | null;
    confidence_score?: number | null;
}

export async function createDocument(
    document: CreateDocumentInput
): Promise<DocumentRecord> {
    const result = await pool.query<DocumentRecord>(
        `
      INSERT INTO documents (
        id,
        file_name,
        blob_name,
        blob_url,
        processing_status,
        processed_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        file_name,
        blob_name,
        blob_url,
        document_type,
        measure,
        measure_date,
        date_processed,
        processed_by,
        processing_status,
        error_message,
        confidence_score,
        created_at,
        updated_at
    `,
        [
            document.id,
            document.file_name,
            document.blob_name,
            document.blob_url,
            document.processing_status,
            document.processed_by ?? "User",
        ]
    );

    return result.rows[0];
}

export async function findAllDocuments(): Promise<DocumentRecord[]> {
    const result = await pool.query<DocumentRecord>(
        `
      SELECT
        id,
        file_name,
        blob_name,
        blob_url,
        document_type,
        measure,
        measure_date,
        date_processed,
        processed_by,
        processing_status,
        error_message,
        confidence_score,
        created_at,
        updated_at
      FROM documents
      ORDER BY created_at DESC
    `
    );

    return result.rows;
}

export async function findDocumentById(
    id: string
): Promise<DocumentRecord | null> {
    const result = await pool.query<DocumentRecord>(
        `
      SELECT
        id,
        file_name,
        blob_name,
        blob_url,
        document_type,
        measure,
        measure_date,
        date_processed,
        processed_by,
        processing_status,
        error_message,
        confidence_score,
        created_at,
        updated_at
      FROM documents
      WHERE id = $1
    `,
        [id]
    );

    return result.rows[0] ?? null;
}

export async function updateDocumentProcessing(
    id: string,
    document: UpdateDocumentProcessingInput
): Promise<DocumentRecord | null> {
    const result = await pool.query<DocumentRecord>(
        `
      UPDATE documents
      SET
        document_type = $1,
        measure = $2,
        measure_date = $3,
        date_processed = $4,
        processed_by = $5,
        processing_status = $6,
        error_message = $7,
        confidence_score = $8,
        updated_at = NOW()
      WHERE id = $9
      RETURNING
        id,
        file_name,
        blob_name,
        blob_url,
        document_type,
        measure,
        measure_date,
        date_processed,
        processed_by,
        processing_status,
        error_message,
        confidence_score,
        created_at,
        updated_at
    `,
        [
            document.document_type ?? null,
            document.measure ?? null,
            document.measure_date ?? null,
            document.date_processed ?? null,
            document.processed_by ?? null,
            document.processing_status,
            document.error_message ?? null,
            document.confidence_score ?? null,
            id
        ]
    );

    return result.rows[0] ?? null;
}

export async function resetDocumentForRetry(
    id: string
): Promise<DocumentRecord | null> {
    const result = await pool.query<DocumentRecord>(
        `
      UPDATE documents
      SET
        document_type = NULL,
        measure = NULL,
        measure_date = NULL,
        date_processed = NULL,
        processed_by = COALESCE(processed_by, 'User'),
        processing_status = 'PROCESSING',
        claimed_at = NULL,
        error_message = NULL,
        confidence_score = NULL,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        file_name,
        blob_name,
        blob_url,
        document_type,
        measure,
        measure_date,
        date_processed,
        processed_by,
        processing_status,
        error_message,
        confidence_score,
        created_at,
        updated_at
    `,
        [id]
    );

    return result.rows[0] ?? null;
}