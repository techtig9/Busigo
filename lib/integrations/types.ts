export type IntegrationProvider = "gmail" | "google_calendar" | "google_sheets" | "slack" | "hubspot" | "notion" | "airtable";
export type IntegrationAction = { provider: IntegrationProvider; operation: string; input: Record<string, unknown> };
export type IntegrationResult = { ok: boolean; provider: IntegrationProvider; operation: string; data?: unknown; error?: string };

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  health(): Promise<IntegrationResult>;
  execute(operation: string, input: Record<string, unknown>): Promise<IntegrationResult>;
}
