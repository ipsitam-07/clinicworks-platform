@description('Location for Logic App')
param location string

@description('Tags for Logic App resources')
param tags object = {}

@description('Name of the Logic App workflow')
param logicAppName string

@description('Base URL of the Azure Function App (e.g. https://func-clinicworks-dev.azurewebsites.net)')
param functionAppUrl string

@description('Recipient email for document review and failure alerts')
param alertRecipientEmail string = ''

@description('Optional webhook URL to dispatch alert notifications (e.g. Logic App HTTP, SendGrid webhook, or Teams/Slack)')
param alertNotificationWebhookUrl string = ''

@description('Web App base URL for dashboard links in email alerts')
param webAppUrl string = ''

// API Connection for Office 365 Outlook ("Send an email (V2)")
resource office365Connection 'Microsoft.Web/connections@2016-06-01' = {
  name: 'office365'
  location: location
  tags: tags
  properties: {
    displayName: 'Office 365 Outlook'
    customParameterValues: {}
    api: {
      id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'office365')
    }
  }
}

resource logicApp 'Microsoft.Logic/workflows@2019-05-01' = {
  name: logicAppName
  location: location
  tags: tags
  properties: {
    state: 'Enabled'
    definition: {
      '$schema': 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#'
      contentVersion: '1.0.0.0'
      parameters: {
        '$connections': {
          type: 'Object'
          defaultValue: {
            office365: {
              connectionId: office365Connection.id
              connectionName: 'office365'
              id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'office365')
            }
          }
        }
        functionProcessDocumentUrl: {
          type: 'String'
          defaultValue: '${functionAppUrl}/api/process-document'
        }
        alertRecipientEmail: {
          type: 'String'
          defaultValue: alertRecipientEmail
        }
        alertNotificationWebhookUrl: {
          type: 'String'
          defaultValue: alertNotificationWebhookUrl
        }
        webAppUrl: {
          type: 'String'
          defaultValue: webAppUrl
        }
      }
      triggers: {
        manual: {
          type: 'Request'
          kind: 'Http'
          inputs: {
            schema: {
              type: 'object'
              properties: {
                documentId: {
                  type: 'string'
                }
                fileName: {
                  type: 'string'
                }
              }
              required: [
                'documentId'
              ]
            }
          }
        }
      }
      actions: {
        Call_Azure_Function: {
          type: 'Http'
          inputs: {
            method: 'POST'
            uri: '@parameters(\'functionProcessDocumentUrl\')'
            headers: {
              'Content-Type': 'application/json'
            }
            body: {
              documentId: '@triggerBody()?[\'documentId\']'
              fileName: '@triggerBody()?[\'fileName\']'
            }
          }
          runAfter: {}
        }
        Condition_Needs_Review_Or_Failed: {
          type: 'If'
          expression: {
            or: [
              {
                equals: [
                  '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'\')'
                  'NEEDS_REVIEW'
                ]
              }
              {
                equals: [
                  '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'\')'
                  'FAILED'
                ]
              }
              {
                equals: [
                  '@coalesce(body(\'Call_Azure_Function\')?[\'status\'], \'\')'
                  'error'
                ]
              }
            ]
          }
          runAfter: {
            Call_Azure_Function: [
              'Succeeded'
              'Failed'
            ]
          }
          actions: {
            Compose_Alert_Payload: {
              type: 'Compose'
              inputs: {
                documentId: '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'id\'], triggerBody()?[\'documentId\'])'
                fileName: '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'file_name\'], triggerBody()?[\'fileName\'])'
                status: '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'FAILED\')'
                documentType: '@body(\'Call_Azure_Function\')?[\'document\']?[\'document_type\']'
                measure: '@body(\'Call_Azure_Function\')?[\'document\']?[\'measure\']'
                confidenceScore: '@body(\'Call_Azure_Function\')?[\'document\']?[\'confidence_score\']'
                errorMessage: '@coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'error_message\'], body(\'Call_Azure_Function\')?[\'message\'])'
                recipientEmail: '@parameters(\'alertRecipientEmail\')'
                dashboardUrl: '@parameters(\'webAppUrl\')'
                timestamp: '@utcNow()'
              }
              runAfter: {}
            }
            Send_an_email_V2: {
              type: 'ApiConnection'
              inputs: {
                host: {
                  connection: {
                    name: '@parameters(\'$connections\')[\'office365\'][\'connectionId\']'
                  }
                }
                method: 'post'
                path: '/v2/Mail'
                body: {
                  To: '@parameters(\'alertRecipientEmail\')'
                  Subject: '@concat(\'[Action Required] ClinicWorks Alert: \', coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'file_name\'], triggerBody()?[\'fileName\']), \' is \', coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'FAILED\'))'
                  Body: '<div style="font-family: Arial, sans-serif; color: #222; max-width: 600px;"><h2 style="color: #c0392b;">ClinicWorks Document Processing Alert</h2><p>A document has completed processing and requires attention:</p><table style="border-collapse: collapse; width: 100%;"><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">File Name</td><td style="padding: 8px;">@{coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'file_name\'], triggerBody()?[\'fileName\'])}</td></tr><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Status</td><td style="padding: 8px; font-weight: bold; color: #c0392b;">@{coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'FAILED\')}</td></tr><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Document Type</td><td style="padding: 8px;">@{body(\'Call_Azure_Function\')?[\'document\']?[\'document_type\']}</td></tr><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Extracted Measure</td><td style="padding: 8px;">@{body(\'Call_Azure_Function\')?[\'document\']?[\'measure\']}</td></tr><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Confidence Score</td><td style="padding: 8px;">@{body(\'Call_Azure_Function\')?[\'document\']?[\'confidence_score\']}</td></tr><tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px; font-weight: bold;">Details / Error</td><td style="padding: 8px;">@{coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'error_message\'], body(\'Call_Azure_Function\')?[\'message\'])}</td></tr></table><p style="margin-top: 20px;"><a href="@{parameters(\'webAppUrl\')}" style="background-color: #0066cc; color: #fff; padding: 10px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">Open ClinicWorks Dashboard</a></p></div>'
                  Importance: 'High'
                }
              }
              runAfter: {
                Compose_Alert_Payload: [
                  'Succeeded'
                ]
              }
            }
          }
        }
        Response: {
          type: 'Response'
          inputs: {
            statusCode: 200
            headers: {
              'Content-Type': 'application/json'
            }
            body: '@body(\'Call_Azure_Function\')'
          }
          runAfter: {
            Condition_Needs_Review_Or_Failed: [
              'Succeeded'
              'Failed'
              'Skipped'
            ]
          }
        }
      }
      outputs: {}
    }
  }
}

output logicAppId string = logicApp.id
output logicAppName string = logicApp.name

@secure()
output callbackUrl string = listCallbackUrl(resourceId('Microsoft.Logic/workflows/triggers', logicApp.name, 'manual'), '2019-05-01').value
