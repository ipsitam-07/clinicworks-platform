import express from "express";
import "dotenv/config";

import { testDatabaseConnection } from "./config/db";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        message: "ClinicWorks API is running"
    });
});

app.listen(PORT, async () => {
    console.log(`ClinicWorks API running on port ${PORT}`);

    try {
        await testDatabaseConnection();
    } catch (error) {
        console.error("ClinicWorks database connection failed:", error);
    }
});