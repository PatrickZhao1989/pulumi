import * as pulumi from "@pulumi/pulumi"
import * as azureNext from "@pulumi/azure-nextgen"

// constants
const projectName = pulumi.getProject()
const stack = pulumi.getStack()

const projectConfig = new pulumi.Config(projectName)
const azureConfig = new pulumi.Config("azure")

// project specific environment variables
const resourceGroupName = projectConfig.require("resourceGroupName")
const tag_createdBy = projectConfig.require("createdBy")
const sqlUsername = projectConfig.require("sqlUserName")
const sqlPassword = projectConfig.require("sqlPassword")
const cosmosThroughput = projectConfig.require("cosmosThroughput")

// Azure specific environment variables
const location = azureConfig.require("location")
const subscriptionId = azureNext.config.subscriptionId

// Others
const resourceDefaultPrefix = `${projectName.toLowerCase().replace(/-/g, "")}${stack.toLowerCase().replace(/-/g, "")}`
const resourceGroupArgs = {
	resourceGroupName: resourceGroupName,
	location: location,
}
const commonTags = {
	Environment: stack,
	CreatedBy: tag_createdBy,
}

// Front-end storage account
const frontendStorageAccountName = `${resourceDefaultPrefix}sa`
const frontend_storageAccount = new azureNext.storage.latest.StorageAccount("frontendStorageAccount", {
	...resourceGroupArgs,
	accountName: frontendStorageAccountName,
	kind: "Storage",
	sku: {
		name: "Standard_GRS",
	},
	tags: { ...commonTags },
})

// App service plan
const appServicePlanName = `${resourceDefaultPrefix}aplx`
const appServicePlan = new azureNext.web.v20200601.AppServicePlan("appServicePlan", {
	name: appServicePlanName,
	kind: "linux",
	...resourceGroupArgs,
	sku: {
		capacity: 1,
		family: "P",
		name: "P1v2",
		tier: "PremiumV2",
	},
	reserved: true,
	tags: {
		...commonTags,
	},
})

// Application Insight
const appInsightsName = `${resourceDefaultPrefix}ai`
const appInsight = new azureNext.insights.latest.Component("component", {
	resourceName: appInsightsName,
	applicationType: "web",
	flowType: "Bluefield",
	kind: "web",
	requestSource: "rest",
	...resourceGroupArgs,
	tags: {
		...commonTags,
	},
})

// SQL Server
// location has to be AU East
const sqlServerName = `${resourceDefaultPrefix}ss`
const server = new azureNext.sql.latest.Server("server", {
	serverName: sqlServerName,
	administratorLogin: sqlUsername,
	administratorLoginPassword: sqlPassword,
	location: "Australia East",
	resourceGroupName: resourceGroupName,
	tags: {
		...commonTags,
	},
})

// SQL Database
// location has to be AU East
const sqlDatabaseName = `${resourceDefaultPrefix}testdb`
const database = new azureNext.sql.latest.Database("database", {
	databaseName: sqlDatabaseName,
	serverName: server.name,
	location: "Australia East",
	resourceGroupName: resourceGroupName,
})

// Cosmos DB
const cosmosAccountName = `${resourceDefaultPrefix}cmdbacc`
const cosmosDbAccount = new azureNext.documentdb.latest.DatabaseAccount("cosmosdbaccount", {
	accountName: cosmosAccountName,
	backupPolicy: {
		periodicModeProperties: {
			backupIntervalInMinutes: 240,
			backupRetentionIntervalInHours: 8,
		},
		type: "Periodic",
	},
	consistencyPolicy: {
		defaultConsistencyLevel: "Session",
		maxIntervalInSeconds: 10,
		maxStalenessPrefix: 200,
	},
	cors: [
		{
			allowedOrigins: "https://test",
		},
	],
	databaseAccountOfferType: "Standard",
	enableAnalyticalStorage: true,
	enableFreeTier: true,
	locations: [
		{
			failoverPriority: 0,
			isZoneRedundant: false,
			locationName: "Australia SouthEast",
		},
		{
			failoverPriority: 1,
			isZoneRedundant: false,
			locationName: "Australia East",
		},
	],
	...resourceGroupArgs,
	tags: {
		...commonTags,
	},
})

const sqlResourceSqlContainer = new azureNext.documentdb.latest.SqlResourceSqlContainer("sqlResourceSqlContainer", {
    accountName: cosmosDbAccount.name,
    containerName: "containerName",
    databaseName: "databaseName",
    location: "West US",
    options: {},
    resource: {
        conflictResolutionPolicy: {
            conflictResolutionPath: "/path",
            mode: "LastWriterWins",
        },
        defaultTtl: 100,
        id: "containerName",
        indexingPolicy: {
            automatic: true,
            excludedPaths: [],
            includedPaths: [{
                indexes: [
                    {
                        dataType: "String",
                        kind: "Range",
                        precision: -1,
                    },
                    {
                        dataType: "Number",
                        kind: "Range",
                        precision: -1,
                    },
                ],
                path: "/*",
            }],
            indexingMode: "Consistent",
        },
        partitionKey: {
            kind: "Hash",
            paths: ["/AccountNumber"],
        },
        uniqueKeyPolicy: {
            uniqueKeys: [{
                paths: ["/testPath"],
            }],
        },
    },
    resourceGroupName: "rg1",
    tags: {},
});


// Backend API
const backendAPIName = `${resourceDefaultPrefix}api`
const backendApi = new azureNext.web.v20200601.WebApp("webapp", {
	...resourceGroupArgs,
	tags: {
		...commonTags,
	},
	name: backendAPIName,
	serverFarmId: pulumi.interpolate`/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/serverfarms/${appServicePlan.name}`,

	siteConfig: {
		appSettings: [
			{
				name: "APPINSIGHTS_INSTRUMENTATIONKEY",
				value: appInsight.instrumentationKey,
			},
			{
				name: "APPLICATIONINSIGHTS_CONNECTION_STRING",
				value: pulumi.interpolate`InstrumentationKey=${appInsight.instrumentationKey}`,
			},
			{
				name: "ApplicationInsightsAgent_EXTENSION_VERSION",
				value: "~2",
			},
		],
		connectionStrings: [
			{
				name: "DefaultConnectionString",
				connectionString: `Server=tcp:${sqlServerName}.database.windows.net;initial catalog=${database.name};user ID=${sqlUsername};password=${sqlPassword};Persist Security Info=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`,
				type: "SQLAzure",
			},
		],
	},
})

// Function App
const functionAppName = `${resourceDefaultPrefix}func`
const functionApp = new azureNext.web.v20200601.WebApp("funcitonapp", {
	...resourceGroupArgs,
	tags: {
		...commonTags,
	},
	kind: "functionapp",
	name: functionAppName,
	serverFarmId: pulumi.interpolate`/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.Web/serverfarms/${appServicePlan.name}`,

	siteConfig: {
		appSettings: [
			{
				name: "APPINSIGHTS_INSTRUMENTATIONKEY",
				value: appInsight.instrumentationKey,
			},
			{
				name: "APPLICATIONINSIGHTS_CONNECTION_STRING",
				value: pulumi.interpolate`InstrumentationKey=${appInsight.instrumentationKey}`,
			},
			{
				name: "ApplicationInsightsAgent_EXTENSION_VERSION",
				value: "~2",
			},
		],
		connectionStrings: [
			{
				name: "DefaultConnectionString",
				connectionString: `Server=tcp:${sqlServerName}.database.windows.net;initial catalog=${database.name};user ID=${sqlUsername};password=${sqlPassword};Persist Security Info=False;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;`,
				type: "SQLAzure",
			},
		],
	},
})

// Export result
export const output = {
	prefix: stack,
	resourceGroupName: resourceGroupName,
	tag_createdBy: tag_createdBy,
	location: location,
	createdResource: {
		frontEndStorageAccount: frontend_storageAccount.name,
		appServicePlan: appServicePlan.name,
		appInsight: appInsight.name,
		sql: {
			serverName: server.name,
			serverLocation: server.location,
			databaseName: database.name,
		},
		backendApi: {
			name: backendApi.name,
			hostingPlan: backendApi.hostNames,
		},
		functionApp: {
			name: functionApp.name,
			functionAppId: functionApp.hostNames,
		},
		cosmos: {
			cosmosDbAccount: cosmosDbAccount.name
		}

	},
}
