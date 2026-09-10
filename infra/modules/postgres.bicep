@description('Location for PostgreSQL Flexible Server')
param location string

@description('Tags for PostgreSQL resources')
param tags object = {}

@description('Unique name of the PostgreSQL Flexible Server')
param serverName string

@description('Database administrator login name')
param administratorLogin string = 'clinicworks'

@description('Database administrator password')
@secure()
param administratorLoginPassword string

@description('Name of the initial application database')
param databaseName string = 'clinicworks'

@description('Compute SKU name for PostgreSQL Flexible Server')
param skuName string = 'Standard_B1ms'

@description('PostgreSQL major version')
param version string = '16'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-12-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: 'Burstable'
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorLoginPassword
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-12-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Allow connections from any Azure resource (App Service, Function App)
resource firewallAzureIps 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-12-01-preview' = {
  parent: postgresServer
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverId string = postgresServer.id
output serverName string = postgresServer.name
output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output administratorLogin string = administratorLogin
