@description('Location for Function App')
param location string

@description('Tags for Function App resources')
param tags object = {}

@description('Name of the Function App')
param functionAppName string

@description('Name of the App Service Hosting Plan for Functions')
param hostingPlanName string

@description('Storage Account connection string for AzureWebJobsStorage')
@secure()
param storageAccountConnectionString string

@description('Application Insights connection string')
@secure()
param appInsightsConnectionString string

@description('PostgreSQL server host FQDN')
param postgresHost string

@description('PostgreSQL port')
param postgresPort string = '5432'

@description('PostgreSQL database name')
param postgresDatabase string = 'clinicworks'

@description('PostgreSQL user')
param postgresUser string = 'clinicworks'

@description('PostgreSQL password')
@secure()
param postgresPassword string

@description('Azure Document Intelligence Endpoint')
param docIntelEndpoint string = ''

@description('Azure Document Intelligence API Key')
@secure()
param docIntelKey string = ''

@description('Standard OpenAI API Key')
@secure()
param openaiApiKey string

resource hostingPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: hostingPlanName
  location: location
  tags: tags
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    reserved: true
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|20'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: storageAccountConnectionString
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'DB_HOST'
          value: postgresHost
        }
        {
          name: 'DB_PORT'
          value: postgresPort
        }
        {
          name: 'DB_NAME'
          value: postgresDatabase
        }
        {
          name: 'DB_USER'
          value: postgresUser
        }
        {
          name: 'DB_PASSWORD'
          value: postgresPassword
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: storageAccountConnectionString
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: 'documents'
        }
        {
          name: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'
          value: docIntelEndpoint
        }
        {
          name: 'AZURE_DOCUMENT_INTELLIGENCE_KEY'
          value: docIntelKey
        }
        {
          name: 'OPENAI_API_KEY'
          value: openaiApiKey
        }
      ]
    }
  }
}

output functionAppId string = functionApp.id
output functionAppName string = functionApp.name
output defaultHostName string = functionApp.properties.defaultHostName
output principalId string = functionApp.identity.principalId
