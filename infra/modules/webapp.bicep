@description('Location for Web App')
param location string

@description('Tags for Web App resources')
param tags object = {}

@description('Name of the Web App')
param webAppName string

@description('Name of the App Service Plan')
param appServicePlanName string

@description('Compute SKU for App Service Plan')
param skuName string = 'B1'

@description('ACR Login Server (e.g. clinicworksacr.azurecr.io)')
param acrLoginServer string

@description('Container Image Name')
param imageName string = 'clinicworks-api'

@description('Container Image Tag')
param imageTag string = 'latest'

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

@description('Azure Storage connection string')
@secure()
param storageConnectionString string

@description('Azure Function App Base URL')
param functionAppUrl string

@description('Azure Logic App Webhook Trigger URL')
param logicAppUrl string

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: skuName
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    reserved: true
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/${imageName}:${imageTag}'
      alwaysOn: true
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'PORT'
          value: '3000'
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
          value: storageConnectionString
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: 'documents'
        }
        {
          name: 'AZURE_FUNCTION_URL'
          value: functionAppUrl
        }
        {
          name: 'LOGIC_APP_URL'
          value: logicAppUrl
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
      ]
    }
  }
}

output webAppId string = webApp.id
output webAppName string = webApp.name
output defaultHostName string = webApp.properties.defaultHostName
output principalId string = webApp.identity.principalId
