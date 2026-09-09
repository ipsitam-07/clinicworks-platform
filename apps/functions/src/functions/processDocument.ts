import {
  app,
  InvocationContext,
  HttpRequest,
  HttpResponseInit,
} from '@azure/functions'
import { downloadBlobToBuffer } from '../services/storage.service'
import { extractClinicalDataFromPdf } from '../services/extractor.service'
import {
  findDocumentByBlobName,
  updateDocumentResult,
  claimDocumentForProcessing,
} from '../services/db.service'

/**
 * Core processing routine for a single document.
 */
export async function processDocumentById(
  documentId: string,
  context?: InvocationContext,
  callerName: string = 'direct'
) {
  context?.log(`[processDocument] Caller "${callerName}" attempting to claim document ID: ${documentId}`)

  // 1. Atomic claim check 
  const doc = await claimDocumentForProcessing(documentId, callerName)
  if (!doc) {
    context?.log(
      `[processDocument] Document ${documentId} is already claimed by another trigger or not in PROCESSING status. Skipping.`
    )
    return null
  }

  context?.log(`[processDocument] Lock acquired by "${callerName}" for document "${doc.file_name}" (${documentId}). Processing...`)

  if (!doc.blob_name) {
    const errorMsg = `Document ${documentId} has no blob_name associated`
    await updateDocumentResult(documentId, {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: null,
      status: 'FAILED',
      errorMessage: errorMsg,
      processedBy: callerName,
    })
    throw new Error(errorMsg)
  }

  try {
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
      processedBy: callerName,
    })

    context?.log(`[processDocument] Successfully completed processing for document ${documentId}`)
    return updatedDoc
  } catch (err) {
    const errorMessage = (err as Error).message
    context?.error(`[processDocument] Processing failed for document ${documentId}:`, errorMessage)
    await updateDocumentResult(documentId, {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: null,
      status: 'FAILED',
      errorMessage,
      processedBy: callerName,
    })
    throw err
  }
}

app.storageBlob('processDocumentBlob', {
  path: 'documents/{name}',
  connection: 'AzureWebJobsStorage',
  handler: async (blob: Buffer, context: InvocationContext) => {
    const blobName = (context.triggerMetadata?.name as string) || ''
    context.log(`[Blob Trigger] New blob detected: ${blobName}. Waiting 15s for primary orchestrator (Logic App)...`)

    // Wait 15 seconds to allow Logic App to claim the document first
    await new Promise((resolve) => setTimeout(resolve, 15000))

    try {
      let doc = await findDocumentByBlobName(blobName)

      if (!doc) {
        doc = await findDocumentByBlobName(`documents/${blobName}`)
      }

      if (!doc) {
        context.warn(`[Blob Trigger] No matching document record found for blob: ${blobName}`)
        return
      }

      if (doc.processing_status !== 'PROCESSING' || doc.claimed_at) {
        context.log(
          `[Blob Trigger] Document "${blobName}" (${doc.id}) has already been handled (status: ${doc.processing_status}, claimed_at: ${doc.claimed_at}). Skipping duplicate processing.`
        )
        return
      }

      context.log(`[Blob Trigger] Document "${blobName}" (${doc.id}) was not claimed by Logic App. Triggering fallback processing...`)
      await processDocumentById(doc.id, context, 'blob-trigger-fallback')
    } catch (err) {
      context.error(`[Blob Trigger Error] Processing failed for ${blobName}:`, err)
    }
  },
})

/**
 * 2. HTTP Trigger: Primary endpoint invoked by Azure Logic Apps workflow (and manual/test calls)
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

      const result = await processDocumentById(docId, context, 'logic-app-http')

      if (!result) {
        return {
          status: 200,
          jsonBody: {
            status: 'already_claimed_or_processed',
            message: `Document ${docId} is already claimed or processed by another trigger.`,
          },
        }
      }

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
