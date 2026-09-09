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
        await client.query("ALTER TABLE documents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;");
        console.log("ClinicWorks database connection successful (schema verified)");
    } finally {
        client.release();
    }
}