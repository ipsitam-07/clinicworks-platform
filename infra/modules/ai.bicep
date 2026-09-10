@description('Location for Azure AI Document Intelligence')
param location string

@description('Tags for AI resources')
param tags object = {}

@description('Name of the Azure Document Intelligence account')
param documentIntelligenceName string

@description('Pricing tier SKU for Document Intelligence')
@allowed([
  'F0'
  'S0'
])
param skuName string = 'S0'

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: documentIntelligenceName
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: toLower(documentIntelligenceName)
    publicNetworkAccess: 'Enabled'
  }
}

output id string = documentIntelligence.id
output name string = documentIntelligence.name
output endpoint string = documentIntelligence.properties.endpoint

@secure()
output apiKey string = documentIntelligence.listKeys().key1
