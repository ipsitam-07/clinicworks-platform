import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

export interface RawAiBloodPressureCandidate {
  systolic: number | null
  diastolic: number | null
  date: string | null
  isGoalOrTarget: boolean
  isPastOrHistorical: boolean
  rawTextSnippet: string
}

export interface RawAiHbA1cCandidate {
  value: number | null
  date: string | null
  isGoalOrTarget: boolean
  isReferenceRange: boolean
  isPastOrHistorical: boolean
  rawTextSnippet: string
}

export interface RawAiExtractionResult {
  documentType: 'BP' | 'HbA1c' | 'UNKNOWN'
  patientAge: number | null
  patientDob: string | null
  documentObservationDate: string | null
  bloodPressureReadings: RawAiBloodPressureCandidate[]
  hba1cReadings: RawAiHbA1cCandidate[]
  extractionConfidence: number
  extractionNotes: string | null
}

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is missing from environment variables')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export async function extractClinicalCandidatesWithAI(
  documentText: string,
  fileName: string
): Promise<RawAiExtractionResult> {
  const client = getOpenAIClient()

  const systemPrompt = `You are an expert clinical medical record extraction engine for ClinicWorks.
Your task is to analyze document text extracted from clinical PDFs/reports and identify all clinical observations with zero hallucination.

Guidelines:
1. Identify the primary documentType: "BP" (Blood Pressure), "HbA1c" (Hemoglobin A1c / Glycated Hemoglobin), or "UNKNOWN".
2. Extract the patient's age (in years) if mentioned, or calculate it from the Date of Birth if an observation date exists.
3. For Blood Pressure:
   - Extract ALL blood pressure readings found in the document.
   - For each reading, record systolic, diastolic, reading date, whether it is a "goal/target", and whether it is a "past/previous/historical" reading vs a current observation.
   - Never combine numbers across different readings.
4. For HbA1c:
   - Extract ALL HbA1c / A1C / Glycated Hemoglobin values (numeric percentage).
   - Distinguish real patient measurements from "reference ranges" (e.g. "<5.7% Normal"), "goals/targets", or "historical" comparisons.
5. Identify the primary document/observation date (Date of Service, Collection Date, Exam Date) in ISO YYYY-MM-DD format. Do NOT confuse this with the patient's birth date.
6. Provide an extraction confidence score between 0.0 and 1.0 representing how clearly and unambiguously the text communicates the data.`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `File name: "${fileName}"\n\nDocument text content:\n"""\n${documentText.slice(0, 15000)}\n"""`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ClinicalDocumentExtraction',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            documentType: {
              type: 'string',
              enum: ['BP', 'HbA1c', 'UNKNOWN'],
              description: 'Primary clinical type of the document',
            },
            patientAge: {
              type: ['number', 'null'],
              description: 'Patient age in years, or null if unknown',
            },
            patientDob: {
              type: ['string', 'null'],
              description: 'Patient Date of Birth in YYYY-MM-DD or null',
            },
            documentObservationDate: {
              type: ['string', 'null'],
              description: 'Primary observation/collection date in YYYY-MM-DD or null',
            },
            bloodPressureReadings: {
              type: 'array',
              description: 'All blood pressure observations extracted from the text',
              items: {
                type: 'object',
                properties: {
                  systolic: { type: ['number', 'null'] },
                  diastolic: { type: ['number', 'null'] },
                  date: { type: ['string', 'null'], description: 'Date of reading in YYYY-MM-DD or null' },
                  isGoalOrTarget: {
                    type: 'boolean',
                    description: 'True if explicitly marked as goal, target, or recommended threshold',
                  },
                  isPastOrHistorical: {
                    type: 'boolean',
                    description: 'True if explicitly marked as prior, previous, historical, or baseline',
                  },
                  rawTextSnippet: { type: 'string', description: 'Surrounding text snippet' },
                },
                required: [
                  'systolic',
                  'diastolic',
                  'date',
                  'isGoalOrTarget',
                  'isPastOrHistorical',
                  'rawTextSnippet',
                ],
                additionalProperties: false,
              },
            },
            hba1cReadings: {
              type: 'array',
              description: 'All HbA1c percentage values extracted from the text',
              items: {
                type: 'object',
                properties: {
                  value: { type: ['number', 'null'], description: 'Percentage e.g. 6.8' },
                  date: { type: ['string', 'null'], description: 'Date in YYYY-MM-DD or null' },
                  isGoalOrTarget: {
                    type: 'boolean',
                    description: 'True if goal or target threshold',
                  },
                  isReferenceRange: {
                    type: 'boolean',
                    description: 'True if laboratory reference interval e.g. < 5.7%',
                  },
                  isPastOrHistorical: {
                    type: 'boolean',
                    description: 'True if prior or historical test result',
                  },
                  rawTextSnippet: { type: 'string', description: 'Surrounding text snippet' },
                },
                required: [
                  'value',
                  'date',
                  'isGoalOrTarget',
                  'isReferenceRange',
                  'isPastOrHistorical',
                  'rawTextSnippet',
                ],
                additionalProperties: false,
              },
            },
            extractionConfidence: {
              type: 'number',
              description: 'Confidence between 0.0 and 1.0',
            },
            extractionNotes: {
              type: ['string', 'null'],
              description: 'Any ambiguity notes or summary of observations',
            },
          },
          required: [
            'documentType',
            'patientAge',
            'patientDob',
            'documentObservationDate',
            'bloodPressureReadings',
            'hba1cReadings',
            'extractionConfidence',
            'extractionNotes',
          ],
          additionalProperties: false,
        },
      },
    },
  })

  const rawJson = response.choices[0]?.message?.content
  if (!rawJson) {
    throw new Error('OpenAI returned an empty completion response')
  }

  return JSON.parse(rawJson) as RawAiExtractionResult
}
