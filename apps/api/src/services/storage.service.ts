import {
    BlobServiceClient,
    BlobSASPermissions,
} from "@azure/storage-blob";

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING ?? "";
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME ?? "documents";

function getBlobServiceClient(): BlobServiceClient {
    if (!CONNECTION_STRING) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set");
    }
    return BlobServiceClient.fromConnectionString(CONNECTION_STRING);
}

export async function ensureContainerExists(): Promise<void> {
    const client = getBlobServiceClient();
    const container = client.getContainerClient(CONTAINER_NAME);
    await container.createIfNotExists();
    console.log(`Blob container "${CONTAINER_NAME}" is ready`);
}

// Upload

export interface UploadResult {
    blobName: string;
    blobUrl: string;
}

export async function uploadFileToBlob(
    documentId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string
): Promise<UploadResult> {
    const client = getBlobServiceClient();
    const container = client.getContainerClient(CONTAINER_NAME);

    const date = new Date();
    const yearMonth = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}`;
    const blobName = `${yearMonth}/${documentId}/${fileName}`;

    const blobClient = container.getBlockBlobClient(blobName);

    await blobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: { blobContentType: mimeType },
    });

    return {
        blobName,
        blobUrl: blobClient.url,
    };
}

// Delete

export async function deleteFileFromBlob(blobName: string): Promise<void> {
    const client = getBlobServiceClient();
    const container = client.getContainerClient(CONTAINER_NAME);
    const blobClient = container.getBlobClient(blobName);
    await blobClient.deleteIfExists();
}


// SAS URL

export async function generateSasUrl(
    blobName: string,
    expiresInMinutes = 60
): Promise<string> {
    const client = getBlobServiceClient();
    const container = client.getContainerClient(CONTAINER_NAME);
    const blobClient = container.getBlobClient(blobName);

    const expiresOn = new Date();
    expiresOn.setMinutes(expiresOn.getMinutes() + expiresInMinutes);
    const sasUrl = await blobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
    });

    return sasUrl;
}
