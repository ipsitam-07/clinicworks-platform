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

// API Connection for Outlook.com ("Send an email (V2)")
resource outlookConnection 'Microsoft.Web/connections@2016-06-01' = {
  name: 'outlook'
  location: location
  tags: tags
  properties: {
    displayName: alertRecipientEmail != '' ? alertRecipientEmail : 'Outlook.com'
    customParameterValues: {}
    api: {
      id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'outlook')
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
            outlook: {
              connectionId: outlookConnection.id
              connectionName: 'outlook'
              id: subscriptionResourceId('Microsoft.Web/locations/managedApis', location, 'outlook')
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
        Handle_Function_Failure_Or_Timeout: {
          type: 'If'
          expression: {
            or: [
              {
                equals: [
                  '@actions(\'Call_Azure_Function\')?[\'status\']'
                  'Failed'
                ]
              }
              {
                equals: [
                  '@actions(\'Call_Azure_Function\')?[\'status\']'
                  'TimedOut'
                ]
              }
            ]
          }
          runAfter: {
            Call_Azure_Function: [
              'Failed'
              'TimedOut'
            ]
          }
          actions: {
            Send_Function_Crash_Email: {
              type: 'ApiConnection'
              inputs: {
                host: {
                  connection: {
                    name: '@parameters(\'$connections\')[\'outlook\'][\'connectionId\']'
                  }
                }
                method: 'post'
                path: '/v2/Mail'
                body: {
                  To: '@parameters(\'alertRecipientEmail\')'
                  Subject: '@concat(\'ClinicWorks Error: Function Failed - \', coalesce(triggerBody()?[\'fileName\'], triggerBody()?[\'documentId\']))'
                  Body: '<p><strong>ClinicWorks Function Failure</strong></p><p>Azure Function failed or timed out while processing: <strong>@{coalesce(triggerBody()?[\'fileName\'], triggerBody()?[\'documentId\'])}</strong></p><p><strong>Status:</strong> @{actions(\'Call_Azure_Function\')?[\'status\']}<br/><strong>Error:</strong> @{actions(\'Call_Azure_Function\')?[\'error\']?[\'message\']}</p><p><a href="@{parameters(\'webAppUrl\')}">Open Dashboard</a></p>'
                  Importance: 'High'
                }
              }
              runAfter: {}
            }
          }
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
              {
                less: [
                  '@float(coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'confidence_score\'], \'1.0\'))'
                  '@float(0.8)'
                ]
              }
            ]
          }
          runAfter: {
            Call_Azure_Function: [
              'Succeeded'
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
                extractedJson: '@body(\'Call_Azure_Function\')'
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
                    name: '@parameters(\'$connections\')[\'outlook\'][\'connectionId\']'
                  }
                }
                method: 'post'
                path: '/v2/Mail'
                body: {
                  To: '@parameters(\'alertRecipientEmail\')'
                  Subject: '@concat(\'ClinicWorks Review: \', coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'file_name\'], triggerBody()?[\'fileName\']), \' - \', coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'NEEDS_REVIEW\'))'
                  Body: '<p><strong>ClinicWorks Document Alert</strong></p><p>Document <strong>@{coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'file_name\'], triggerBody()?[\'fileName\'])}</strong> requires manual review.</p><p><strong>Status:</strong> @{coalesce(body(\'Call_Azure_Function\')?[\'document\']?[\'processing_status\'], \'NEEDS_REVIEW\')}<br/><strong>Measure:</strong> @{body(\'Call_Azure_Function\')?[\'document\']?[\'measure\']}<br/><strong>Confidence:</strong> @{body(\'Call_Azure_Function\')?[\'document\']?[\'confidence_score\']}</p><p><a href="@{parameters(\'webAppUrl\')}">Open Dashboard</a></p>'
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
            statusCode: '@if(equals(actions(\'Call_Azure_Function\')?[\'status\'], \'Succeeded\'), 200, 500)'
            headers: {
              'Content-Type': 'application/json'
            }
            body: '@coalesce(body(\'Call_Azure_Function\'), actions(\'Call_Azure_Function\'))'
          }
          runAfter: {
            Condition_Needs_Review_Or_Failed: [
              'Succeeded'
              'Skipped'
            ]
            Handle_Function_Failure_Or_Timeout: [
              'Succeeded'
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
