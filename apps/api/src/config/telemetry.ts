/**
 * Application Insights telemetry initializer.
 */
import appInsights from "applicationinsights";

export function initTelemetry(): void {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
        console.log("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled");
        return;
    }

    appInsights
        .setup(connectionString)
        .setAutoCollectRequests(true)        // Every HTTP request to the API
        .setAutoCollectDependencies(true)    // Outbound calls: Postgres, Blob, Document Intelligence, OpenAI
        .setAutoCollectExceptions(true)      // Unhandled exceptions
        .setAutoCollectConsole(true, true)   // console.log/error - AppTraces in Log Analytics
        .setSendLiveMetrics(false)           // Enable in portal ad-hoc; not needed always-on
        .start();

    console.log("[AppInsights] Telemetry enabled — sending to Application Insights");
}
