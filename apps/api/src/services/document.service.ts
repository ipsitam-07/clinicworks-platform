import {
    createDocument,
    findAllDocuments,
    findDocumentById,
    resetDocumentForRetry,
    updateDocumentProcessing,
    type UpdateDocumentProcessingInput,
} from "../repository/document.repository";
import { uploadFileToBlob, deleteFileFromBlob } from "./storage.service";
import { randomUUID } from "crypto";


// Types

export interface CreateDocumentServiceInput {
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
    processedBy?: string | null;
}

/**
 * Triggers the processing workflow.
 * Priority 1: Azure Logic App 
 */
function triggerProcessingWorkflow(documentId: string, fileName?: string) {
    const logicAppUrl = process.env.LOGIC_APP_URL;
    const functionUrl = process.env.AZURE_FUNCTION_URL;

    if (logicAppUrl) {
        fetch(logicAppUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId, fileName }),
        }).catch((err) => {
            console.error("Logic App workflow trigger failed:", err);
        });
        return;
    }

    if (functionUrl) {
        fetch(`${functionUrl}/api/process-document`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId }),
        }).catch((err) => {
            console.error("Direct Azure Function trigger failed:", err);
        });
    }
}

// Create

export async function createDocumentService(input: CreateDocumentServiceInput) {
    const documentId = randomUUID();

    const { blobName, blobUrl } = await uploadFileToBlob(
        documentId,
        input.fileName,
        input.fileBuffer,
        input.mimeType
    );

    try {
        const createdDoc = await createDocument({
            id: documentId,
            file_name: input.fileName,
            blob_name: blobName,
            blob_url: blobUrl,
            processing_status: "PROCESSING",
            processed_by: input.processedBy || "User",
        });

        // Trigger the Logic App workflow immediately upon upload
        triggerProcessingWorkflow(createdDoc.id, createdDoc.file_name);

        return createdDoc;
    } catch (dbError) {
        await deleteFileFromBlob(blobName).catch((cleanupError) => {
            console.error("Failed to clean up orphaned blob:", cleanupError);
        });
        throw dbError;
    }
}

// Read

export async function getAllDocumentsService() {
    return findAllDocuments();
}

export async function getDocumentByIdService(id: string) {
    return findDocumentById(id);
}

// Update

export async function updateDocumentProcessingService(
    id: string,
    document: UpdateDocumentProcessingInput
) {
    return updateDocumentProcessing(id, document);
}

// Retry

export async function retryDocumentService(id: string) {
    const document = await findDocumentById(id);

    if (!document) {
        return null;
    }

    if (document.processing_status !== "FAILED") {
        throw new Error("Only failed documents can be retried");
    }

    if (!document.blob_name) {
        throw new Error("Cannot retry document: no file blob found in storage");
    }

    const resetDoc = await resetDocumentForRetry(id);

    if (resetDoc) {
        // Trigger the exact same Logic App workflow on retry
        triggerProcessingWorkflow(resetDoc.id, resetDoc.file_name);
    }

    return resetDoc;
}