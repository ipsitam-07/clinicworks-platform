import {
  app,
  InvocationContext,
  HttpRequest,
  HttpResponseInit,
} from '@azure/functions'
import { downloadBlobToBuffer } from '../services/storage.service'
import { extractClinicalDataFromPdf } from '../services/extractor.service'
import {
  findDocumentById,
  findDocumentByBlobName,
  updateDocumentResult,
} from '../services/db.service'

/**
 * Core processing routine for a single document
 */
export async function processDocumentById(
  documentId: string,
  context?: InvocationContext
) {
  context?.log(`[processDocument] Starting processing for document ID: ${documentId}`)

  const doc = await findDocumentById(documentId)
  if (!doc) {
    throw new Error(`Document with ID ${documentId} not found in database`)
  }

  if (!doc.blob_name) {
    throw new Error(`Document ${documentId} has no blob_name associated`)
  }

  context?.log(`[processDocument] Downloading blob: ${doc.blob_name}`)
  const pdfBuffer = await downloadBlobToBuffer(doc.blob_name)

  context?.log(`[processDocument] Extracting clinical measurements for "${doc.file_name}"`)
  const extraction = await extractClinicalDataFromPdf(pdfBuffer, doc.file_name)

  context?.log(
    `[processDocument] Extracted: type=${extraction.documentType}, measure=${extraction.measure}, score=${extraction.confidenceScore}, status=${extraction.status}`
  )

  const updatedDoc = await updateDocumentResult(documentId, {
    documentType: extraction.documentType,
    measure: extraction.measure,
    measureDate: extraction.measureDate,
    confidenceScore: extraction.confidenceScore,
    status: extraction.status,
    errorMessage: extraction.errorMessage,
  })

  context?.log(`[processDocument] Successfully updated document ${documentId}`)
  return updatedDoc
}

/**
 * 1. Blob Trigger: Runs automatically when a PDF is uploaded to "documents" container
 */
app.storageBlob('processDocumentBlob', {
  path: 'documents/{name}',
  connection: 'AzureWebJobsStorage',
  handler: async (blob: Buffer, context: InvocationContext) => {
    const blobName = (context.triggerMetadata?.name as string) || ''
    context.log(`[Blob Trigger] New blob detected: ${blobName}`)

    try {
      let doc = await findDocumentByBlobName(blobName)

      if (!doc) {
        doc = await findDocumentByBlobName(`documents/${blobName}`)
      }

      if (!doc) {
        context.warn(`[Blob Trigger] No matching document record found for blob: ${blobName}`)
        return
      }

      await processDocumentById(doc.id, context)
    } catch (err) {
      context.error(`[Blob Trigger Error] Processing failed for ${blobName}:`, err)
    }
  },
})

/**
 * 2. HTTP Trigger: For manual / test invocation
 */
app.http('processDocumentHttp', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'process-document',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = (await request.json()) as { documentId?: string; blobName?: string }

      let docId = body.documentId
      if (!docId && body.blobName) {
        const doc = await findDocumentByBlobName(body.blobName)
        docId = doc?.id
      }

      if (!docId) {
        return {
          status: 400,
          jsonBody: { error: 'Please provide a valid documentId or blobName in JSON request body' },
        }
      }

      const result = await processDocumentById(docId, context)

      return {
        status: 200,
        jsonBody: {
          status: 'success',
          document: result,
        },
      }
    } catch (err) {
      context.error('[HTTP Trigger Error]:', err)
      return {
        status: 500,
        jsonBody: {
          status: 'error',
          message: (err as Error).message,
        },
      }
    }
  },
})
