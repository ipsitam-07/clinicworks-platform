import { Pool } from "pg";

export const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || "clinicworks",
    user: process.env.DB_USER || "clinicworks",
    password: process.env.DB_PASSWORD || "clinicworks_dev",
});

export async function testDatabaseConnection(): Promise<void> {
    const client = await pool.connect();

    try {
        await client.query("SELECT 1");
        console.log("ClinicWorks database connection successful");
    } finally {
        client.release();
    }
}