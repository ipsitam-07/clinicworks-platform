import {
  RawAiExtractionResult,
  RawAiBloodPressureCandidate,
} from './ai-extractor.service'

export interface ClinicalEvaluationResult {
  documentType: 'BP' | 'HbA1c' | null
  measure: string | null
  measureDate: string | null
  confidenceScore: number
  status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED'
  errorMessage: string | null
}

interface ConfidenceFactors {
  modelQuality: number
  completeness: number
  formatValidity: number
  businessRuleFit: number
}

function computeConfidenceScore(factors: ConfidenceFactors): number {
  const score =
    0.25 * factors.modelQuality +
    0.25 * factors.completeness +
    0.25 * factors.formatValidity +
    0.25 * factors.businessRuleFit
  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100
}

/**
 * Evaluates Blood Pressure candidates against the assignment's clinical rules
 */
export function evaluateBloodPressureRules(
  aiResult: RawAiExtractionResult,
  fallbackDate: string | null
): ClinicalEvaluationResult {
  // Patient under 18 check
  if (aiResult.patientAge !== null && aiResult.patientAge < 18) {
    return {
      documentType: 'BP',
      measure: null,
      measureDate: aiResult.documentObservationDate || fallbackDate,
      confidenceScore: 0.5,
      status: 'NEEDS_REVIEW',
      errorMessage: `Patient is ${aiResult.patientAge} years old. Clinical rule rejects BP measurements for patients under 18.`,
    }
  }

  // Filter out non-current readings (goals, targets, past/historical)
  const validCandidates = aiResult.bloodPressureReadings.filter(r => {
    // Exclude goals, targets, previous, or historical
    if (r.isGoalOrTarget || r.isPastOrHistorical) {
      return false
    }
    // Systolic and diastolic must both be present numbers
    if (r.systolic === null || r.diastolic === null) {
      return false
    }
    // Basic physiological boundary check
    if (r.systolic < 50 || r.systolic > 260 || r.diastolic < 30 || r.diastolic > 160) {
      return false
    }
    if (r.systolic <= r.diastolic) {
      return false
    }
    return true
  })

  if (validCandidates.length === 0) {
    const isUnderstood = aiResult.documentType === 'BP' || aiResult.bloodPressureReadings.length > 0
    return {
      documentType: 'BP',
      measure: null,
      measureDate: aiResult.documentObservationDate || fallbackDate,
      confidenceScore: 0.5,
      status: isUnderstood ? 'NEEDS_REVIEW' : 'FAILED',
      errorMessage: 'Blood pressure reading incomplete (missing systolic or diastolic) or only non-current readings recorded.',
    }
  }

  // Single valid reading
  let chosenReading: RawAiBloodPressureCandidate
  // 1.0 = unambiguous single reading, lower = tie-break/fallback logic had to kick in
  let businessRuleFit = 1.0

  if (validCandidates.length === 1) {
    chosenReading = validCandidates[0]
  } else {
    // Multiple valid readings -> Pick most recent if dates are distinct
    const withDates = validCandidates.filter(r => !!r.date)
    if (withDates.length === validCandidates.length) {
      const sortedByDate = [...validCandidates].sort((a, b) => {
        return new Date(b.date!).getTime() - new Date(a.date!).getTime()
      })
      const mostRecentDate = sortedByDate[0].date!
      const tiedReadings = sortedByDate.filter(r => r.date === mostRecentDate)

      if (tiedReadings.length === 1) {
        chosenReading = tiedReadings[0]
        businessRuleFit = 0.85 // multiple readings, but cleanly resolved by date
      } else {
        chosenReading = selectLowestBpReading(tiedReadings)
        businessRuleFit = 0.6 // date tie, had to fall back to lowest-sum rule
      }
    } else {
      chosenReading = selectLowestBpReading(validCandidates)
      businessRuleFit = 0.6 // dates missing/inconsistent, fell back to lowest-sum rule
    }
  }

  const measure = `${chosenReading.systolic}/${chosenReading.diastolic} mmHg`
  const measureDate = chosenReading.date || aiResult.documentObservationDate || fallbackDate

  const modelQuality = Math.min(1, Math.max(0, aiResult.extractionConfidence)) *
    (aiResult.extractionNotes ? 0.85 : 1)
  const completeness = measureDate ? 1 : 2 / 3
  const formatValidity =
    chosenReading.systolic! >= 90 && chosenReading.systolic! <= 180 &&
      chosenReading.diastolic! >= 60 && chosenReading.diastolic! <= 110
      ? 1
      : 0.6

  const confidenceScore = computeConfidenceScore({
    modelQuality,
    completeness,
    formatValidity,
    businessRuleFit,
  })
  const status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED' =
    confidenceScore >= 0.8 ? 'SUCCESS' : 'NEEDS_REVIEW'

  return {
    documentType: 'BP',
    measure,
    measureDate,
    confidenceScore,
    status,
    errorMessage: null,
  }
}

function selectLowestBpReading(readings: RawAiBloodPressureCandidate[]): RawAiBloodPressureCandidate {
  return [...readings].sort((a, b) => {
    const sumA = (a.systolic ?? 0) + (a.diastolic ?? 0)
    const sumB = (b.systolic ?? 0) + (b.diastolic ?? 0)
    return sumA - sumB
  })[0]
}

/**
 * Evaluates HbA1c candidates against the assignment's clinical rules
 */
export function evaluateHbA1cRules(
  aiResult: RawAiExtractionResult,
  fallbackDate: string | null
): ClinicalEvaluationResult {
  const nonGoalNonReference = aiResult.hba1cReadings.filter(r => {
    if (r.isGoalOrTarget || r.isReferenceRange) {
      return false
    }
    if (r.value === null || isNaN(r.value)) {
      return false
    }
    // Biological feasibility check (typically 3.0% to 20.0%)
    if (r.value < 3.0 || r.value > 20.0) {
      return false
    }
    return true
  })

  const currentCandidates = nonGoalNonReference.filter(r => !r.isPastOrHistorical)
  const validCandidates = currentCandidates.length > 0 ? currentCandidates : nonGoalNonReference

  if (validCandidates.length === 0) {
    const isUnderstood = aiResult.documentType === 'HbA1c' || aiResult.hba1cReadings.length > 0
    return {
      documentType: 'HbA1c',
      measure: null,
      measureDate: aiResult.documentObservationDate || fallbackDate,
      confidenceScore: 0.5,
      status: isUnderstood ? 'NEEDS_REVIEW' : 'FAILED',
      errorMessage: 'No valid HbA1c observation found (values were reference ranges, goals, or historical examples).',
    }
  }

  const sorted = [...validCandidates].sort((a, b) => (a.value ?? 0) - (b.value ?? 0))
  const chosen = sorted[0]
  const val = chosen.value!

  let classification = ''
  if (val > 5.9) {
    classification = 'Diabetes'
  } else if (val > 5.7) {
    classification = 'Prediabetes'
  }

  const measure = classification ? `${val}% (${classification})` : `${val}%`
  const measureDate = chosen.date || aiResult.documentObservationDate || fallbackDate


  const modelQuality = Math.min(1, Math.max(0, aiResult.extractionConfidence)) *
    (aiResult.extractionNotes ? 0.85 : 1)
  const completeness = measureDate ? 1 : 0.5
  const formatValidity = val >= 4.0 && val <= 15.0 ? 1 : 0.6
  const businessRuleFit = validCandidates.length === 1 ? 1.0 : 0.85

  const confidenceScore = computeConfidenceScore({
    modelQuality,
    completeness,
    formatValidity,
    businessRuleFit,
  })
  const status: 'SUCCESS' | 'NEEDS_REVIEW' | 'FAILED' =
    confidenceScore >= 0.8 ? 'SUCCESS' : 'NEEDS_REVIEW'

  return {
    documentType: 'HbA1c',
    measure,
    measureDate,
    confidenceScore,
    status,
    errorMessage: null,
  }
}

/**
 * Master dispatcher applying clinical rules based on detected document type
 */
export function applyClinicalBusinessRules(
  aiResult: RawAiExtractionResult,
  fileName: string,
  fallbackDate: string | null
): ClinicalEvaluationResult {
  const lowerName = fileName.toLowerCase()
  const isBpHint = lowerName.includes('bp') || lowerName.includes('blood_pressure') || lowerName.includes('hypertension')
  const isHba1cHint = lowerName.includes('hba1c') || lowerName.includes('a1c') || lowerName.includes('diabetes')

  const docType = aiResult.documentType !== 'UNKNOWN'
    ? aiResult.documentType
    : isBpHint
      ? 'BP'
      : isHba1cHint
        ? 'HbA1c'
        : null

  if (docType === 'BP') {
    return evaluateBloodPressureRules(aiResult, fallbackDate)
  }

  if (docType === 'HbA1c') {
    return evaluateHbA1cRules(aiResult, fallbackDate)
  }

  // check candidates if documentType was uncertain
  if (aiResult.bloodPressureReadings.length > 0 && aiResult.hba1cReadings.length === 0) {
    return evaluateBloodPressureRules(aiResult, fallbackDate)
  }

  if (aiResult.hba1cReadings.length > 0 && aiResult.bloodPressureReadings.length === 0) {
    return evaluateHbA1cRules(aiResult, fallbackDate)
  }

  return {
    documentType: null,
    measure: null,
    measureDate: aiResult.documentObservationDate || fallbackDate,
    confidenceScore: 0,
    status: 'FAILED',
    errorMessage: 'No BP or HbA1c observation identified in document.',
  }
}
