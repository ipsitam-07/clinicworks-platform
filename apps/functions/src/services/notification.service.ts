export interface DocumentAlertPayload {
  documentId: string
  fileName?: string | null
  status: 'NEEDS_REVIEW' | 'FAILED'
  documentType?: string | null
  measure?: string | null
  confidenceScore?: number | null
  errorMessage?: string | null
  dashboardUrl?: string
  timestamp?: string
}

/**
 * Dispatches an alert notification when a document processing result is NEEDS_REVIEW or FAILED.
 * Sends the alert payload to the configured Webhook URL (e.g. Logic App HTTP trigger).
 */
export async function sendDocumentAlertNotification(payload: DocumentAlertPayload): Promise<boolean> {
  const alertWebhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.POWER_AUTOMATE_WEBHOOK_URL
  const dashboardUrl = payload.dashboardUrl || process.env.WEB_APP_URL || ''

  payload.dashboardUrl = dashboardUrl
  payload.timestamp = payload.timestamp || new Date().toISOString()

  if (!alertWebhookUrl) {
    return false
  }

  try {
    const resp = await fetch(alertWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (resp.ok) {
      console.log(`[notification] Successfully dispatched alert webhook for document ${payload.documentId} (${payload.status})`)
      return true
    } else {
      const errorText = await resp.text().catch(() => '')
      console.error(`[notification] Alert webhook failed with HTTP ${resp.status}: ${errorText}`)
      return false
    }
  } catch (err) {
    console.error('[notification] Error sending alert webhook:', err)
    return false
  }
}
