@description('Location for alert resources')
param location string

@description('Tags for alert resources')
param tags object = {}

@description('Name of the Action Group')
param actionGroupName string

@description('Short name for the Action Group (max 12 characters)')
param actionGroupShortName string = 'cwdev'

@description('Recipient email for alert notifications')
param alertRecipientEmail string

@description('Resource ID of the App Service Plan for CPU and Memory metrics')
param appServicePlanId string

@description('Resource ID of the Web App for HTTP 5xx metric')
param webAppId string

@description('Name of the Web App for URL construction')
param webAppName string

@description('Resource ID of Application Insights')
param appInsightsId string

@description('Name of Application Insights')
param appInsightsName string

@description('Resource ID of PostgreSQL Flexible Server')
param postgresServerId string

@description('Resource ID of Log Analytics Workspace')
param logAnalyticsWorkspaceId string

// 1. Action Group (Email notifications)
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'global'
  tags: tags
  properties: {
    groupShortName: actionGroupShortName
    enabled: true
    emailReceivers: [
      {
        name: 'clinicworks-oncall'
        emailAddress: alertRecipientEmail
        useCommonAlertSchema: false
      }
    ]
  }
}

// 2. Application Availability Web Test (Ping /api/health)
resource webTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: 'clinicworks-health-ping-${appInsightsName}'
  location: location
  tags: union(tags, {
    'hidden-link:${appInsightsId}': 'Resource'
  })
  properties: {
    SyntheticMonitorId: 'clinicworks-health-ping-${appInsightsName}'
    Name: 'clinicworks-health-ping'
    Description: 'Health ping test for /api/health endpoint'
    Enabled: true
    Frequency: 300
    Timeout: 120
    Kind: 'standard'
    RetryEnabled: true
    Locations: [
      {
        Id: 'apac-sg-sin-azr'
      }
      {
        Id: 'apac-hk-hkn-azr'
      }
      {
        Id: 'emea-ru-msa-edge'
      }
    ]
    Request: {
      RequestUrl: 'https://${webAppName}.azurewebsites.net/api/health'
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: true
      SSLCertRemainingLifetimeCheck: 7
    }
  }
}

// 3. Metric Alert: Availability (Ping failing from >= 2 locations)
resource alertAvailability 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-availability-clinicworks'
  location: 'global'
  tags: tags
  properties: {
    description: 'Health ping failing from >=2 regions'
    severity: 1
    enabled: true
    scopes: [
      webTest.id
      appInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: webTest.id
      componentId: appInsightsId
      failedLocationCount: 2
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 4. Metric Alert: High CPU Utilization (> 80%)
resource alertCpuHigh 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-cpu-high-clinicworks'
  location: 'global'
  tags: tags
  properties: {
    description: 'App Service Plan CPU above 80% for 5 min'
    severity: 2
    enabled: true
    scopes: [
      appServicePlanId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'CpuPercentage'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 5. Metric Alert: High Memory Utilization (> 80%)
resource alertMemoryHigh 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-memory-high-clinicworks'
  location: 'global'
  tags: tags
  properties: {
    description: 'App Service Plan memory above 80% for 5 min'
    severity: 2
    enabled: true
    scopes: [
      appServicePlanId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'MemoryPercentage'
          operator: 'GreaterThan'
          threshold: 80
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 6. Metric Alert: PostgreSQL Failed Connections
resource alertDbFailedConnections 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-db-failed-connections'
  location: 'global'
  tags: tags
  properties: {
    description: 'PostgreSQL failed connections detected'
    severity: 1
    enabled: true
    scopes: [
      postgresServerId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'connections_failed'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 7. Metric Alert: PostgreSQL Server Not Alive
resource alertDbAvailability 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-db-availability'
  location: 'global'
  tags: tags
  properties: {
    description: 'PostgreSQL server not responding'
    severity: 0
    enabled: true
    scopes: [
      postgresServerId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'is_db_alive'
          operator: 'LessThan'
          threshold: 1
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 8. Metric Alert: Network / External Dependency Failures (> 5)
resource alertDependencyFailures 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-dependency-failures'
  location: 'global'
  tags: tags
  properties: {
    description: 'Dependency failure rate spike (blob/db/AI calls)'
    severity: 2
    enabled: true
    scopes: [
      appInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'dependencies/failed'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 9. Metric Alert: Web App HTTP 5xx Server Errors
resource alertHttp5xx 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-http5xx-clinicworks'
  location: 'global'
  tags: tags
  properties: {
    description: 'Web App returning HTTP 5xx errors'
    severity: 1
    enabled: true
    scopes: [
      webAppId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 10. Metric Alert: Application Insights Unhandled Exceptions
resource alertExceptions 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-exceptions-clinicworks'
  location: 'global'
  tags: tags
  properties: {
    description: 'Unhandled exceptions logged in Application Insights'
    severity: 2
    enabled: true
    scopes: [
      appInsightsId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'cond0'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'exceptions/count'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// 11. Scheduled Query Rule: Failed Document Processing Jobs
resource alertDocProcessingFailed 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: 'alert-doc-processing-failed'
  location: location
  tags: tags
  properties: {
    description: 'Document processing job failed — check worker or blob trigger logs'
    severity: 1
    enabled: true
    scopes: [
      logAnalyticsWorkspaceId
    ]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: 'AppTraces | where TimeGenerated > ago(15m) | where Message has \'Error processing document\' or Message has \'Processing failed\' or Message has \'Blob Trigger Error\''
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Count'
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroup.id
      ]
    }
  }
}

output actionGroupId string = actionGroup.id
output webTestId string = webTest.id
