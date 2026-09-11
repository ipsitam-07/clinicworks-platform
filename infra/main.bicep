targetScope = 'resourceGroup'

@description('Deployment environment name')
@allowed([
  'dev'
  'prod'
])
param environment string = 'dev'

@description('Primary Azure location for all resources')
param location string = resourceGroup().location

@description('Prefix for resource naming')
@minLength(3)
@maxLength(15)
param prefix string = 'clinicworks'

@description('ACR Login Server hosting container images')
param acrLoginServer string = 'clinicworksacr.azurecr.io'

@description('Image tag for Web App container')
param imageTag string = 'latest'

@description('PostgreSQL Flexible Server administrator password')
@secure()
param postgresAdminPassword string

@description('Standard OpenAI API Key for clinical measure extraction')
@secure()
param openaiApiKey string

@description('Recipient email for document review and failure alerts')
param alertRecipientEmail string = 'ipsitamoh07@gmail.com'

@description('Optional alert notification webhook URL')
param alertNotificationWebhookUrl string = ''

// Resource Naming Conventions
var commonTags = {
  Project: 'ClinicWorks'
  Environment: environment
  ManagedBy: 'Bicep'
}

var logAnalyticsWorkspaceName = 'log-${prefix}-${environment}'
var appInsightsName = 'appi-${prefix}-${environment}'
var storageAccountName = 'st${prefix}${environment}'
var postgresServerName = 'psql-${prefix}-${environment}'
var keyVaultName = 'vault-${prefix}-${environment}'
var docIntelName = 'docintel-${prefix}-${environment}'
var functionAppName = 'func-${prefix}-${environment}'
var functionHostingPlanName = 'asp-func-${prefix}-${environment}'
var webAppName = 'app-${prefix}-platform-${environment}'
var webAppHostingPlanName = 'asp-web-${prefix}-${environment}'
var logicAppName = 'logic-${prefix}-${environment}'

// 1. Monitoring (Log Analytics + App Insights)
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoringDeployment'
  params: {
    location: location
    tags: commonTags
    logAnalyticsWorkspaceName: logAnalyticsWorkspaceName
    appInsightsName: appInsightsName
  }
}

// 2. Storage Account (Blob Storage for documents)
module storage 'modules/storage.bicep' = {
  name: 'storageDeployment'
  params: {
    location: location
    tags: commonTags
    storageAccountName: storageAccountName
    containerName: 'documents'
  }
}

// 3. PostgreSQL Flexible Server
module postgres 'modules/postgres.bicep' = {
  name: 'postgresDeployment'
  params: {
    location: location
    tags: commonTags
    serverName: postgresServerName
    administratorLogin: 'clinicworks'
    administratorLoginPassword: postgresAdminPassword
    databaseName: 'clinicworks'
    skuName: environment == 'prod' ? 'Standard_D2ds_v5' : 'Standard_B1ms'
  }
}

// 4. Azure Document Intelligence (OCR for scanned PDFs)
module ai 'modules/ai.bicep' = {
  name: 'aiDeployment'
  params: {
    location: location
    tags: commonTags
    documentIntelligenceName: docIntelName
    skuName: environment == 'prod' ? 'S0' : 'F0'
  }
}

// 5. Azure Key Vault (Secrets Management)
module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvaultDeployment'
  params: {
    location: location
    tags: commonTags
    keyVaultName: keyVaultName
    postgresPassword: postgresAdminPassword
    storageConnectionString: storage.outputs.connectionString
    openaiApiKey: openaiApiKey
    documentIntelligenceKey: ai.outputs.apiKey
  }
}

// 6. Azure Function App (Clinical Processing Engine)
module functionApp 'modules/functionapp.bicep' = {
  name: 'functionAppDeployment'
  params: {
    location: location
    tags: commonTags
    functionAppName: functionAppName
    hostingPlanName: functionHostingPlanName
    storageAccountConnectionString: storage.outputs.connectionString
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    postgresHost: postgres.outputs.serverFqdn
    postgresPort: '5432'
    postgresDatabase: postgres.outputs.databaseName
    postgresUser: postgres.outputs.administratorLogin
    postgresPassword: postgresAdminPassword
    docIntelEndpoint: ai.outputs.endpoint
    docIntelKey: ai.outputs.apiKey
    openaiApiKey: openaiApiKey
  }
}

var functionAppUrl = 'https://${functionApp.outputs.defaultHostName}'

// 7. Azure Logic App (Workflow Orchestrator)
module logicApp 'modules/logicapp.bicep' = {
  name: 'logicAppDeployment'
  params: {
    location: location
    tags: commonTags
    logicAppName: logicAppName
    functionAppUrl: functionAppUrl
    alertRecipientEmail: alertRecipientEmail
    alertNotificationWebhookUrl: alertNotificationWebhookUrl
    webAppUrl: 'https://${webAppName}.azurewebsites.net'
  }
}

// 8. Azure Web App (Express API + React Dashboard)
module webApp 'modules/webapp.bicep' = {
  name: 'webAppDeployment'
  params: {
    location: location
    tags: commonTags
    webAppName: webAppName
    appServicePlanName: webAppHostingPlanName
    skuName: environment == 'prod' ? 'P1v3' : 'B1'
    acrLoginServer: acrLoginServer
    imageName: 'clinicworks-api'
    imageTag: imageTag
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    postgresHost: postgres.outputs.serverFqdn
    postgresPort: '5432'
    postgresDatabase: postgres.outputs.databaseName
    postgresUser: postgres.outputs.administratorLogin
    postgresPassword: postgresAdminPassword
    storageConnectionString: storage.outputs.connectionString
    functionAppUrl: functionAppUrl
    logicAppUrl: logicApp.outputs.callbackUrl
  }
}

// Outputs
output webAppUrl string = 'https://${webApp.outputs.defaultHostName}'
output functionAppUrl string = functionAppUrl

@secure()
output logicAppCallbackUrl string = logicApp.outputs.callbackUrl
output postgresServerFqdn string = postgres.outputs.serverFqdn
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultName string = keyvault.outputs.vaultName
