import {
    createDocument,
    findAllDocuments,
    findDocumentById,
    resetDocumentForRetry,
    updateDocumentProcessing,
    type CreateDocumentInput,
    type UpdateDocumentProcessingInput,
} from "../repository/document.repository"

export async function createDocumentService(
    document: CreateDocumentInput
) {
    return createDocument(document);
}

export async function getAllDocumentsService() {
    return findAllDocuments();
}

export async function getDocumentByIdService(id: string) {
    return findDocumentById(id);
}

export async function updateDocumentProcessingService(
    id: string,
    document: UpdateDocumentProcessingInput
) {
    return updateDocumentProcessing(id, document);
}

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