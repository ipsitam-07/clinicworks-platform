import { Request, Response } from "express";
import {
    createDocumentService,
    getAllDocumentsService,
    getDocumentByIdService,
    retryDocumentService,
} from "../services/document.service";
import { randomUUID } from "crypto";

export async function createDocument(
    req: Request,
    res: Response
): Promise<void> {
    try {
        const { fileName } = req.body;

        if (!fileName) {
            res.status(400).json({
                status: "error",
                message: "fileName is required",
            });
            return;
        }

        const document = await createDocumentService({
            id: randomUUID(),
            file_name: fileName,
            processing_status: "PROCESSING",
        });

        res.status(201).json({
            status: "success",
            document,
        });
    } catch (error) {
        console.error("Create document error:", error);

        res.status(500).json({
            status: "error",
            message: "Failed to create document",
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