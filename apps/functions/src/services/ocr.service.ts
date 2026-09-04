import DocumentIntelligence, {
  getLongRunningPoller,
  isUnexpected,
} from '@azure-rest/ai-document-intelligence'
import { AzureKeyCredential } from '@azure/core-auth'
import * as dotenv from 'dotenv'

dotenv.config()

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || ''
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || ''

let client: ReturnType<typeof DocumentIntelligence> | null = null

function getClient(): ReturnType<typeof DocumentIntelligence> {
  if (!client) {
    if (!endpoint || !apiKey) {
      throw new Error(
        'Azure Document Intelligence configuration missing. Ensure AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY are set.'
      )
    }
    client = DocumentIntelligence(endpoint, new AzureKeyCredential(apiKey))
  }
  return client
}

export async function performOcrOnPdf(pdfBuffer: Buffer): Promise<string> {
  const docClient = getClient()

  const initialResponse = await docClient
    .path('/documentModels/{modelId}:analyze', 'prebuilt-read')
    .post({
      contentType: 'application/octet-stream',
      body: pdfBuffer,
    })

  if (isUnexpected(initialResponse)) {
    const errorBody = initialResponse.body as { error?: { message?: string } }
    throw new Error(
      `Azure Document Intelligence analyze error: ${errorBody?.error?.message || 'Unknown error'}`
    )
  }

  const poller = getLongRunningPoller(docClient, initialResponse)
  const pollResult = await poller.pollUntilDone()

  if (isUnexpected(pollResult)) {
    const errorBody = pollResult.body as { error?: { message?: string } }
    throw new Error(
      `Azure Document Intelligence polling error: ${errorBody?.error?.message || 'Unknown error'}`
    )
  }

  const analyzeResult = (pollResult.body as { analyzeResult?: { content?: string } }).analyzeResult
  return analyzeResult?.content || ''
}
