import type { IntegrationAdapter, IntegrationProvider } from "./types";

class ConfiguredAdapter implements IntegrationAdapter {
  constructor(public provider: IntegrationProvider) {}
  async health() { return { ok: false, provider: this.provider, operation: "health", error: `${this.provider} OAuth/API credentials are not configured for this environment.` }; }
  async execute(operation: string) { return { ok: false, provider: this.provider, operation, error: `${this.provider} adapter is registered but requires a valid connected account before execution.` }; }
}

const providers: IntegrationProvider[] = ["gmail", "google_calendar", "google_sheets", "slack", "hubspot", "notion", "airtable"];
export function getIntegrationAdapter(provider: IntegrationProvider) { if (!providers.includes(provider)) throw new Error("Unsupported integration provider"); return new ConfiguredAdapter(provider); }
export function listIntegrationProviders() { return providers.map((provider) => ({ provider, status: "adapter-ready", requires_oauth: true })); }
