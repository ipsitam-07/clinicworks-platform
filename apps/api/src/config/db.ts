import { Pool } from "pg";

const isAzure = process.env.DB_HOST && process.env.DB_HOST !== "localhost";

export const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "clinicworks",
    user: process.env.DB_USER || "clinicworks",
    password: process.env.DB_PASSWORD || "clinicworks_dev",
    ssl: isAzure ? { rejectUnauthorized: false } : false,
});

export async function testDatabaseConnection(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query("SELECT 1");
        await client.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY,
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
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS blob_name TEXT;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS blob_url  TEXT;
            ALTER TABLE documents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
        `);
        console.log("ClinicWorks database connection successful (schema verified)");
    } finally {
        client.release();
    }
}