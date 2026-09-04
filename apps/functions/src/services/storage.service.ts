import { BlobServiceClient } from '@azure/storage-blob'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString =
  process.env.AZURE_STORAGE_CONNECTION_STRING ||
  process.env.AzureWebJobsStorage ||
  ''
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents'

let blobServiceClient: BlobServiceClient | null = null

function getClient(): BlobServiceClient {
  if (!blobServiceClient) {
    if (!connectionString) {
      throw new Error('Azure Storage connection string is missing')
    }
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
  }
  return blobServiceClient
}

/**
 * Downloads a blob buffer from Azure Blob Storage given its blobName
 */
export async function downloadBlobToBuffer(blobName: string): Promise<Buffer> {
  const client = getClient()
  const containerClient = client.getContainerClient(containerName)
  const blobClient = containerClient.getBlobClient(blobName)

  const downloadResponse = await blobClient.download()
  const stream = downloadResponse.readableStreamBody
  if (!stream) {
    throw new Error(`Failed to get readable stream for blob: ${blobName}`)
  }

  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}
