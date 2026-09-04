import pdfParse from 'pdf-parse'
import { performOcrOnPdf } from './ocr.service'
import { extractClinicalCandidatesWithAI } from './ai-extractor.service'
import { applyClinicalBusinessRules } from './clinical-rules.service'

export interface ExtractedClinicalData {
  documentType: 'BP' | 'HbA1c' | null
  measure: string | null
  measureDate: string | null // ISO YYYY-MM-DD format
  confidenceScore: number
  status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED'
  errorMessage: string | null
  rawText?: string
}

/**
 * Main parser pipeline
 */
export async function extractClinicalDataFromPdf(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedClinicalData> {
  let text = ''
  let isScannedPdf = false

  // Attempt fast local extraction for native digital PDFs
  try {
    const parsed = await pdfParse(pdfBuffer)
    text = (parsed.text || '').trim()
  } catch (err) {
    console.warn(`[Extractor] Local PDF parse failed for "${fileName}", will attempt Azure OCR:`, (err as Error).message)
  }

  //If no text layer found (scanned image PDF), invoke Azure AI Document Intelligence OCR
  if (!text || text.length < 20) {
    try {
      console.log(`[Extractor] Scanned / image-based PDF detected for "${fileName}". Triggering Azure Document Intelligence OCR...`)
      text = await performOcrOnPdf(pdfBuffer)
      isScannedPdf = true
      console.log(`[Extractor] Azure Document Intelligence OCR extracted ${text.length} characters for "${fileName}".`)
    } catch (ocrErr) {
      console.error(`[Extractor] Azure OCR failed for "${fileName}":`, ocrErr)
      return {
        documentType: null,
        measure: null,
        measureDate: null,
        confidenceScore: 0,
        status: 'FAILED',
        errorMessage: `OCR processing failed: ${(ocrErr as Error).message}`,
      }
    }
  }

  // Validate that document text exists
  if (!text || !text.trim()) {
    return {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: 0,
      status: 'FAILED',
      errorMessage: 'Document contains no extractable text even after Azure Document Intelligence OCR.',
    }
  }

  // Semantic Clinical Candidate Extraction via OpenAI 
  try {
    console.log(`[Extractor] Interpreting clinical content with OpenAI for "${fileName}"...`)
    const aiCandidates = await extractClinicalCandidatesWithAI(text, fileName)

    // Apply Clinical Business Rules 
    const fallbackDate = new Date().toISOString().split('T')[0]
    const evaluation = applyClinicalBusinessRules(aiCandidates, fileName, fallbackDate)

    console.log(
      `[Extractor] Evaluation completed: type=${evaluation.documentType}, measure="${evaluation.measure}", status=${evaluation.status}, confidence=${evaluation.confidenceScore}`
    )

    return {
      documentType: evaluation.documentType,
      measure: evaluation.measure,
      measureDate: evaluation.measureDate,
      confidenceScore: evaluation.confidenceScore,
      status: evaluation.status,
      errorMessage: evaluation.errorMessage,
      rawText: text.slice(0, 1000),
    }
  } catch (aiErr) {
    console.error(`[Extractor] OpenAI extraction failed for "${fileName}":`, aiErr)
    return {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: 0,
      status: 'FAILED',
      errorMessage: `Clinical AI extraction failed: ${(aiErr as Error).message}`,
      rawText: text.slice(0, 500),
    }
  }
}
