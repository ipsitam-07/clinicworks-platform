@description('Location for Key Vault')
param location string

@description('Tags for Key Vault')
param tags object = {}

@description('Globally unique name for Key Vault')
param keyVaultName string

@description('Standard OpenAI API Key')
@secure()
param openaiApiKey string = ''

@description('Database administrator password to store in Key Vault')
@secure()
param postgresPassword string

@description('Storage account connection string to store in Key Vault')
@secure()
param storageConnectionString string

@description('Azure Document Intelligence key to store in Key Vault')
@secure()
param documentIntelligenceKey string = ''

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: false
    accessPolicies: []
  }
}

resource secretDbPassword 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'db-password'
  properties: {
    value: postgresPassword
  }
}

resource secretStorageConn 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'storage-connection-string'
  properties: {
    value: storageConnectionString
  }
}

resource secretOpenAiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(openaiApiKey)) {
  parent: keyVault
  name: 'openai-api-key'
  properties: {
    value: openaiApiKey
  }
}

resource secretDocIntelKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(documentIntelligenceKey)) {
  parent: keyVault
  name: 'doc-intelligence-key'
  properties: {
    value: documentIntelligenceKey
  }
}

output vaultId string = keyVault.id
output vaultName string = keyVault.name
output vaultUri string = keyVault.properties.vaultUri
