import { Request, Response, NextFunction } from "express";
import {
    createDocumentService,
    getAllDocumentsService,
    getDocumentByIdService,
    retryDocumentService,
} from "../services/document.service";
import multer from "multer";

export async function createDocument(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        if (!req.file) {
            res.status(400).json({
                status: "error",
                message: "A PDF file is required. Send it as multipart/form-data with the field name 'file'.",
            });
            return;
        }

        const processedBy =
            (typeof req.body?.processed_by === "string" && req.body.processed_by.trim())
                ? req.body.processed_by.trim()
                : (typeof req.body?.processedBy === "string" && req.body.processedBy.trim())
                    ? req.body.processedBy.trim()
                    : "User";

        const document = await createDocumentService({
            fileName: req.file.originalname,
            fileBuffer: req.file.buffer,
            mimeType: req.file.mimetype,
            processedBy,
        });

        res.status(201).json({
            status: "success",
            document,
        });
    } catch (error) {
        if (error instanceof multer.MulterError) {
            res.status(400).json({
                status: "error",
                message: error.message,
            });
            return;
        }

        if (error instanceof Error && error.message === "Only PDF files are accepted") {
            res.status(400).json({
                status: "error",
                message: error.message,
            });
            return;
        }

        console.error("Create document error:", error);
        res.status(500).json({
            status: "error",
            message: "Failed to upload document",
        });
    }
}


export async function getAllDocuments(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const documents = await getAllDocumentsService();

        res.status(200).json({
            status: "success",
            documents,
        });
    } catch (error) {
        console.error("Get documents error:", error);

        res.status(500).json({
            status: "error",
            message: "Failed to retrieve documents",
        });
    }
}

export async function getDocumentById(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const id = req.params.id as string;

        const document = await getDocumentByIdService(id);

        if (!document) {
            res.status(404).json({
                status: "error",
                message: "Document not found",
            });
            return;
        }

        res.status(200).json({
            status: "success",
            document,
        });
    } catch (error) {
        console.error("Get document error:", error);

        res.status(500).json({
            status: "error",
            message: "Failed to retrieve document",
        });
    }
}

export async function retryDocument(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const id = req.params.id as string;

        const document = await retryDocumentService(id);

        if (!document) {
            res.status(404).json({
                status: "error",
                message: "Document not found",
            });
            return;
        }

        res.status(200).json({
            status: "success",
            message: "Document queued for retry",
            document,
        });
    } catch (error) {
        console.error("Retry document error:", error);

        if (
            error instanceof Error &&
            error.message === "Only failed documents can be retried"
        ) {
            res.status(400).json({
                status: "error",
                message: error.message,
            });
            return;
        }

        res.status(500).json({
            status: "error",
            message: "Failed to retry document",
        });
    }
}