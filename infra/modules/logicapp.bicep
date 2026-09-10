@description('Location for Logic App')
param location string

@description('Tags for Logic App resources')
param tags object = {}

@description('Name of the Logic App workflow')
param logicAppName string

@description('Base URL of the Azure Function App (e.g. https://func-clinicworks-dev.azurewebsites.net)')
param functionAppUrl string

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
        functionProcessDocumentUrl: {
          type: 'String'
          defaultValue: '${functionAppUrl}/api/process-document'
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
            Call_Azure_Function: [
              'Succeeded'
              'Failed'
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
