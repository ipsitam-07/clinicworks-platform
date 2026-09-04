import * as dotenv from 'dotenv'
dotenv.config()

import { getPendingDocuments, pool } from './services/db.service'
import { processDocumentById } from './functions/processDocument'

let isRunning = false

async function pollAndProcess() {
  if (isRunning) return
  isRunning = true

  try {
    const pending = await getPendingDocuments()
    if (pending.length > 0) {
      console.log(`[Worker] Detected ${pending.length} pending document(s). Processing...`)
      for (const doc of pending) {
        try {
          console.log(`[Worker] Processing "${doc.file_name}" (${doc.id})...`)
          const result = await processDocumentById(doc.id)
          console.log(
            `[Worker] ✓ Processed: [${result.processing_status}] Type=${result.document_type || '—'}, Measure=${result.measure || '—'}`
          )
        } catch (err) {
          console.error(`[Worker] ✕ Error processing document ${doc.id}:`, (err as Error).message)
        }
      }
    }
  } catch (err) {
    console.error('[Worker] Error checking pending queue:', (err as Error).message)
  } finally {
    isRunning = false
  }
}

console.log('ClinicWorks — Background Extraction Worker (Active)')
console.log('Polling for new uploaded documents every 2 seconds...')

// Poll every 2 seconds
setInterval(pollAndProcess, 2000)

// Initial immediate poll
pollAndProcess()

// Clean shutdown
process.on('SIGINT', async () => {
  console.log('\nStopping background worker...')
  await pool.end()
  process.exit(0)
})
