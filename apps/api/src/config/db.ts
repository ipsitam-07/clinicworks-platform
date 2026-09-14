import { Pool } from "pg";

const isAzure = process.env.DB_HOST && process.env.DB_HOST !== "localhost";

export const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "clinicworks",
    user: process.env.DB_USER || "clinicadmin",
    password: process.env.DB_PASSWORD || "clinicworks_dev",
    ssl: isAzure ? { rejectUnauthorized: false } : false,
});

export async function testDatabaseConnection(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query("SELECT 1");
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id VARCHAR(50) PRIMARY KEY,
                file_name VARCHAR(255) NOT NULL,
                blob_name TEXT,
                blob_url  TEXT,
                document_type VARCHAR(50),
                measure TEXT,
                measure_date DATE,
                date_processed TIMESTAMPTZ,
                processed_by VARCHAR(100),
                processing_status VARCHAR(30) NOT NULL,
                claimed_at TIMESTAMPTZ,
                error_message TEXT,
                confidence_score NUMERIC(5, 4),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            ALTER TABLE documents ALTER COLUMN id TYPE VARCHAR(50) USING id::text;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS blob_name TEXT;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS blob_url  TEXT;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS processed_by VARCHAR(100);
        `);
        console.log("ClinicWorks database connection successful (schema verified)");
    } finally {
        client.release();
    }
}

export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
        await pool.query("SELECT 1");
        return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
        return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
}