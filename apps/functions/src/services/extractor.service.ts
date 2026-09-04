import pdfParse from 'pdf-parse'

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
 * Standardize extracted date into YYYY-MM-DD
 */
function normalizeDate(rawDateStr: string): string | null {
  try {
    const trimmed = rawDateStr.trim().replace(/^[^\d]+/, '')
    const d = new Date(trimmed)
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0]
    }
  } catch {
    // ignore
  }

  // Regex patterns for DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = rawDateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10)
    const p2 = parseInt(slashMatch[2], 10)
    let y = parseInt(slashMatch[3], 10)
    if (y < 100) y += 2000

    // Assume DD/MM/YYYY if p1 > 12
    if (p1 > 12) {
      const month = String(p2).padStart(2, '0')
      const day = String(p1).padStart(2, '0')
      return `${y}-${month}-${day}`
    } else {
      const month = String(p1).padStart(2, '0')
      const day = String(p2).padStart(2, '0')
      return `${y}-${month}-${day}`
    }
  }

  return null
}

/**
 * Find dates in clinical text near keywords like Date, Collected, Observation, Test Date
 */
function extractObservationDate(text: string): { date: string | null; confidence: number } {
  // Common date labels
  const labelPatterns = [
    /(?:date of (?:service|exam|collection|test)|collection date|test date|exam date|reported date|specimen date|date)[:\s]+([A-Za-z0-9\s,/-]{6,25})/i,
    /(?:collected|observed|performed)[:\s]+([A-Za-z0-9\s,/-]{6,25})/i,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/,
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
  ]

  for (const pattern of labelPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const norm = normalizeDate(match[1])
      if (norm) {
        return { date: norm, confidence: 0.9 }
      }
    }
  }

  return { date: null, confidence: 0.0 }
}

/**
 * Extract Blood Pressure (BP) measurement
 */
function extractBloodPressure(text: string): {
  measure: string | null
  confidence: number
  isAmbiguous: boolean
} {
  // 1. Explicit pattern: "Blood Pressure: 120/80 mmHg" or "BP: 130/85"
  const explicitRegex =
    /(?:blood\s*pressure|sitting\s*bp|bp|b\/p)[\s:=]+(\d{2,3})\s*[/]\s*(\d{2,3})(?:\s*mm\s*hg)?/i
  const explicitMatch = text.match(explicitRegex)

  if (explicitMatch) {
    const sys = parseInt(explicitMatch[1], 10)
    const dia = parseInt(explicitMatch[2], 10)

    // Physiological plausibility check
    if (sys >= 70 && sys <= 240 && dia >= 40 && dia <= 140 && sys > dia) {
      return {
        measure: `${sys}/${dia} mmHg`,
        confidence: 0.95,
        isAmbiguous: false,
      }
    } else {
      return {
        measure: `${sys}/${dia} mmHg`,
        confidence: 0.65,
        isAmbiguous: true,
      }
    }
  }

  // 2. Generic "120/80 mmHg" pattern without explicit BP prefix
  const genericUnitRegex = /(\d{2,3})\s*[/]\s*(\d{2,3})\s*(?:mm\s*hg)/i
  const genericMatch = text.match(genericUnitRegex)
  if (genericMatch) {
    const sys = parseInt(genericMatch[1], 10)
    const dia = parseInt(genericMatch[2], 10)
    if (sys >= 70 && sys <= 240 && dia >= 40 && dia <= 140 && sys > dia) {
      return {
        measure: `${sys}/${dia} mmHg`,
        confidence: 0.9,
        isAmbiguous: false,
      }
    }
  }

  // 3. Standalone fraction with systolic/diastolic keywords
  const sysMatch = text.match(/systolic[\s:=]+(\d{2,3})/i)
  const diaMatch = text.match(/diastolic[\s:=]+(\d{2,3})/i)
  if (sysMatch && diaMatch) {
    const sys = parseInt(sysMatch[1], 10)
    const dia = parseInt(diaMatch[1], 10)
    if (sys > dia) {
      return {
        measure: `${sys}/${dia} mmHg`,
        confidence: 0.92,
        isAmbiguous: false,
      }
    }
  }

  return { measure: null, confidence: 0.0, isAmbiguous: false }
}

/**
 * Extract HbA1c measurement
 */
function extractHbA1c(text: string): {
  measure: string | null
  confidence: number
  isAmbiguous: boolean
} {
  // 1. Explicit pattern: "HbA1c: 6.5%" or "Hemoglobin A1c: 7.2 %"
  const explicitRegex =
    /(?:hemoglobin\s*a1c|hba1c|hb\s*a1c|glycated\s*hemoglobin|glycosylated\s*hemoglobin|a1c)[\s:=]+(\d{1,2}(?:\.\d{1,2})?)\s*[%]?/i
  const explicitMatch = text.match(explicitRegex)

  if (explicitMatch) {
    const val = parseFloat(explicitMatch[1])
    // Physiological plausibility check (typically 4.0% to 16.0%)
    if (val >= 3.5 && val <= 18.0) {
      const formatted = `${val.toFixed(1)}%`
      const isHighCertainty = text.includes('%') || explicitMatch[0].includes('%')
      return {
        measure: formatted,
        confidence: isHighCertainty ? 0.96 : 0.85,
        isAmbiguous: false,
      }
    } else {
      return {
        measure: `${val}%`,
        confidence: 0.6,
        isAmbiguous: true,
      }
    }
  }

  return { measure: null, confidence: 0.0, isAmbiguous: false }
}

/**
 * Main parser entry point: extracts clinical data from PDF buffer
 */
export async function extractClinicalDataFromPdf(
  pdfBuffer: Buffer,
  fileName: string
): Promise<ExtractedClinicalData> {
  let text = ''
  try {
    const parsed = await pdfParse(pdfBuffer)
    text = parsed.text || ''
  } catch (err) {
    return {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: 0,
      status: 'FAILED',
      errorMessage: `Failed to parse PDF binary: ${(err as Error).message}`,
    }
  }

  if (!text.trim()) {
    return {
      documentType: null,
      measure: null,
      measureDate: null,
      confidenceScore: 0,
      status: 'FAILED',
      errorMessage: 'Document contains no extractable text layer (scanned/empty PDF)',
    }
  }

  // Extract observation date
  const { date: measureDate, confidence: dateConfidence } = extractObservationDate(text)

  // Test for BP
  const bpResult = extractBloodPressure(text)

  // Test for HbA1c
  const hba1cResult = extractHbA1c(text)

  // Determine primary document type based on matches and filename hints
  const lowerName = fileName.toLowerCase()
  const isBpHint = lowerName.includes('bp') || lowerName.includes('blood_pressure') || lowerName.includes('hypertension')
  const isHba1cHint = lowerName.includes('hba1c') || lowerName.includes('a1c') || lowerName.includes('diabetes')

  let docType: 'BP' | 'HbA1c' | null = null
  let measure: string | null = null
  let measureConfidence = 0
  let isAmbiguous = false

  if (bpResult.measure && (!hba1cResult.measure || isBpHint || bpResult.confidence > hba1cResult.confidence)) {
    docType = 'BP'
    measure = bpResult.measure
    measureConfidence = bpResult.confidence
    isAmbiguous = bpResult.isAmbiguous
  } else if (hba1cResult.measure) {
    docType = 'HbA1c'
    measure = hba1cResult.measure
    measureConfidence = hba1cResult.confidence
    isAmbiguous = hba1cResult.isAmbiguous
  }

  // If no measure found
  if (!docType || !measure) {
    return {
      documentType: isBpHint ? 'BP' : isHba1cHint ? 'HbA1c' : null,
      measure: null,
      measureDate,
      confidenceScore: 0,
      status: 'FAILED',
      errorMessage: 'Could not detect Blood Pressure or HbA1c measurements in document text',
      rawText: text.substring(0, 500),
    }
  }

  // Calculate final weighted confidence score
  // Measure accounts for 70%, Date accounts for 30%
  const finalScore = Number(
    (measureConfidence * 0.7 + (measureDate ? dateConfidence : 0.5) * 0.3).toFixed(2)
  )

  // Determine final status
  let status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED' = 'SUCCESS'
  if (isAmbiguous || finalScore < 0.8 || !measureDate) {
    status = 'NEEDS_REVIEW'
  }

  return {
    documentType: docType,
    measure,
    measureDate: measureDate || new Date().toISOString().split('T')[0], // Fallback to upload date if not in doc
    confidenceScore: finalScore,
    status,
    errorMessage: null,
  }
}
