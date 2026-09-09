/**
 * Application Insights telemetry initializer for applicationinsights v3.x (OpenTelemetry-based).
 */
import { useAzureMonitor } from "applicationinsights";

export function initTelemetry(): void {
    const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

    if (!connectionString) {
        console.log("[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set — telemetry disabled");
        return;
    }

    try {
        useAzureMonitor({
            azureMonitorExporterOptions: {
                connectionString,
            },
            instrumentationOptions: {
                console: { enabled: true },
                http: { enabled: true },
            },
            enableAutoCollectExceptions: true,
        });

        console.log("[AppInsights] Telemetry enabled — sending to Application Insights via Azure Monitor OpenTelemetry");
    } catch (err) {
        console.error("[AppInsights] Failed to initialize Application Insights:", err);
    }
}
