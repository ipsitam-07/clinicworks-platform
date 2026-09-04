import * as dotenv from 'dotenv'
dotenv.config()

import { getPendingDocuments, pool } from './services/db.service'
import { processDocumentById } from './functions/processDocument'

async function main() {
  console.log('ClinicWorks — Local Document Processing Worker')

  try {
    const pending = await getPendingDocuments()
    console.log(`Found ${pending.length} document(s) with status 'PROCESSING' in database.\n`)

    if (pending.length === 0) {
      console.log('No pending documents to process.')
      return
    }

    for (let i = 0; i < pending.length; i++) {
      const doc = pending[i]
      console.log(`Processing "${doc.file_name}" (ID: ${doc.id})…`)

      try {
        const result = await processDocumentById(doc.id)
        console.log(`Result: [${result.processing_status}] Type=${result.document_type || '—'}, Measure=${result.measure || '—'}, Confidence=${result.confidence_score ? Math.round(Number(result.confidence_score) * 100) + '%' : '—'}`)
        if (result.error_message) {
          console.log(`Note: ${result.error_message}`)
        }
      } catch (err) {
        console.error(`Error processing ${doc.id}:`, (err as Error).message)
      }
      console.log('')
    }

    console.log('Done processing all pending documents!')
  } catch (err) {
    console.error('Worker fatal error:', err)
  } finally {
    await pool.end()
  }
}

main()
