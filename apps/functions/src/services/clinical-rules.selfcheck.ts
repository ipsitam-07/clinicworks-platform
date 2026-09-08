import assert from 'node:assert'
import { evaluateBloodPressureRules, evaluateHbA1cRules } from './clinical-rules.service'
import { RawAiExtractionResult } from './ai-extractor.service'

function baseAiResult(overrides: Partial<RawAiExtractionResult> = {}): RawAiExtractionResult {
  return {
    documentType: 'BP',
    patientAge: 45,
    patientDob: null,
    documentObservationDate: null,
    bloodPressureReadings: [],
    hba1cReadings: [],
    extractionConfidence: 0.95,
    extractionNotes: null,
    ...overrides,
  }
}

// 1. Clean single BP reading, in typical range, with date -> high confidence, SUCCESS
{
  const result = evaluateBloodPressureRules(
    baseAiResult({
      bloodPressureReadings: [
        { systolic: 138, diastolic: 88, date: '2026-08-12', isGoalOrTarget: false, isPastOrHistorical: false, rawTextSnippet: '' },
      ],
    }),
    null
  )
  assert.strictEqual(result.status, 'SUCCESS')
  assert.strictEqual(result.measure, '138/88 mmHg')
  assert.ok(result.confidenceScore >= 0.8, `expected high confidence, got ${result.confidenceScore}`)
}

// 2. Two same-date BP readings -> tie-break to lowest sum, lower confidence
{
  const result = evaluateBloodPressureRules(
    baseAiResult({
      bloodPressureReadings: [
        { systolic: 150, diastolic: 95, date: '2026-08-12', isGoalOrTarget: false, isPastOrHistorical: false, rawTextSnippet: '' },
        { systolic: 130, diastolic: 85, date: '2026-08-12', isGoalOrTarget: false, isPastOrHistorical: false, rawTextSnippet: '' },
      ],
    }),
    null
  )
  assert.strictEqual(result.measure, '130/85 mmHg', 'should pick lowest-sum reading on date tie')
  assert.ok(result.confidenceScore < 1, 'tie-break should reduce confidence below max')
}

// 3. Under-18 patient -> NEEDS_REVIEW, no measure returned
{
  const result = evaluateBloodPressureRules(
    baseAiResult({
      patientAge: 16,
      bloodPressureReadings: [
        { systolic: 120, diastolic: 80, date: '2026-08-12', isGoalOrTarget: false, isPastOrHistorical: false, rawTextSnippet: '' },
      ],
    }),
    null
  )
  assert.strictEqual(result.status, 'NEEDS_REVIEW')
  assert.strictEqual(result.measure, null)
}

// 4. Goal BP only -> filtered out, NEEDS_REVIEW (document understood, no current reading)
{
  const result = evaluateBloodPressureRules(
    baseAiResult({
      bloodPressureReadings: [
        { systolic: 120, diastolic: 80, date: null, isGoalOrTarget: true, isPastOrHistorical: false, rawTextSnippet: 'goal BP' },
      ],
    }),
    null
  )
  assert.strictEqual(result.status, 'NEEDS_REVIEW')
  assert.strictEqual(result.measure, null)
}

// 5. HbA1c 7.4% -> Diabetes classification, single reading -> high confidence
{
  const result = evaluateHbA1cRules(
    baseAiResult({
      documentType: 'HbA1c',
      hba1cReadings: [
        { value: 7.4, date: '2026-07-30', isGoalOrTarget: false, isReferenceRange: false, isPastOrHistorical: false, rawTextSnippet: '' },
      ],
    }),
    null
  )
  assert.strictEqual(result.measure, '7.4% (Diabetes)')
  assert.strictEqual(result.status, 'SUCCESS')
}

// 6. Multiple HbA1c values -> lowest one wins
{
  const result = evaluateHbA1cRules(
    baseAiResult({
      documentType: 'HbA1c',
      hba1cReadings: [
        { value: 6.5, date: '2026-07-30', isGoalOrTarget: false, isReferenceRange: false, isPastOrHistorical: false, rawTextSnippet: '' },
        { value: 5.9, date: '2026-07-30', isGoalOrTarget: false, isReferenceRange: false, isPastOrHistorical: false, rawTextSnippet: '' },
      ],
    }),
    null
  )
  assert.strictEqual(result.measure, '5.9% (Prediabetes)')
}

// 7. Reference-range-only HbA1c -> filtered out, NEEDS_REVIEW
{
  const result = evaluateHbA1cRules(
    baseAiResult({
      documentType: 'HbA1c',
      hba1cReadings: [
        { value: 5.6, date: null, isGoalOrTarget: false, isReferenceRange: true, isPastOrHistorical: false, rawTextSnippet: '<5.7% Normal' },
      ],
    }),
    null
  )
  assert.strictEqual(result.status, 'NEEDS_REVIEW')
  assert.strictEqual(result.measure, null)
}

console.log('All clinical-rules self-checks passed.')
