import {
    createDocument,
    findAllDocuments,
    findDocumentById,
    resetDocumentForRetry,
    updateDocumentProcessing,
    type CreateDocumentInput,
    type UpdateDocumentProcessingInput,
} from "../repository/document.repository";
import { uploadFileToBlob, deleteFileFromBlob } from "./storage.service";
import { randomUUID } from "crypto";


// Types

export interface CreateDocumentServiceInput {
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
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
        return await createDocument({
            id: documentId,
            file_name: input.fileName,
            blob_name: blobName,
            blob_url: blobUrl,
            processing_status: "PROCESSING",
        });
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

    return resetDocumentForRetry(id);
}