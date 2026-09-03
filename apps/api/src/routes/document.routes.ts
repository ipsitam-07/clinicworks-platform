import { Router } from "express";
import {
    createDocument,
    getAllDocuments,
    getDocumentById,
    retryDocument,
} from "../controllers/document.controller";
import { uploadMiddleware } from "../middleware/upload";

const router = Router();

// POST /api/documents
router.post("/", uploadMiddleware, createDocument);

// GET /api/documents
router.get("/", getAllDocuments);

// GET /api/documents/:id
router.get("/:id", getDocumentById);

// POST /api/documents/:id/retry
router.post("/:id/retry", retryDocument);

export default router;

