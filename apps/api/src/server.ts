import express, { Request, Response, NextFunction } from "express";
import "dotenv/config";

import { testDatabaseConnection } from "./config/db";
import documentRoutes from "./routes/document.routes";

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware

app.use(express.json());

// Simple request logger
app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Routes

// Health check
app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        status: "ok",
        service: "clinicworks-api",
        timestamp: new Date().toISOString(),
    });
});

// Document endpoints
app.use("/api/documents", documentRoutes);

// 404 catch-all
app.use((_req: Request, res: Response) => {
    res.status(404).json({ status: "error", message: "Route not found" });
});

// Start

app.listen(PORT, async () => {
    console.log(`ClinicWorks API running on http://localhost:${PORT}`);
    console.log(`Health:    GET  /api/health`);
    console.log(`Documents: GET  /api/documents`);
    console.log(`           POST /api/documents`);
    console.log(`           GET  /api/documents/:id`);
    console.log(`           POST /api/documents/:id/retry\n`);

    try {
        await testDatabaseConnection();
        console.log("PostgreSQL connection verified\n");
    } catch (error) {
        console.error("PostgreSQL connection failed:", error);
    }
});