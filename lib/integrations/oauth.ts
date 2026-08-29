import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { IntegrationProvider } from "./types";

export const oauthProviders = ["gmail", "google_calendar", "google_sheets", "slack", "hubspot", "notion", "airtable"] as const;
type OAuthProvider = typeof oauthProviders[number];

const configs: Record<OAuthProvider, { auth: string; token: string; scopes: string[]; clientId?: string; clientSecret?: string }> = {
  gmail: { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/gmail.send"], clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  google_calendar: { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/calendar.events"], clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  google_sheets: { auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", scopes: ["https://www.googleapis.com/auth/spreadsheets"], clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET },
  slack: { auth: "https://slack.com/oauth/v2/authorize", token: "https://slack.com/api/oauth.v2.access", scopes: ["chat:write"], clientId: process.env.SLACK_CLIENT_ID, clientSecret: process.env.SLACK_CLIENT_SECRET },
  hubspot: { auth: "https://app.hubspot.com/oauth/authorize", token: "https://api.hubapi.com/oauth/v1/token", scopes: ["crm.objects.contacts.write"], clientId: process.env.HUBSPOT_CLIENT_ID, clientSecret: process.env.HUBSPOT_CLIENT_SECRET },
  notion: { auth: "https://api.notion.com/v1/oauth/authorize", token: "https://api.notion.com/v1/oauth/token", scopes: [], clientId: process.env.NOTION_CLIENT_ID, clientSecret: process.env.NOTION_CLIENT_SECRET },
  airtable: { auth: "https://airtable.com/oauth2/v1/authorize", token: "https://airtable.com/oauth2/v1/token", scopes: ["data.records:write", "schema.bases:read"], clientId: process.env.AIRTABLE_CLIENT_ID, clientSecret: process.env.AIRTABLE_CLIENT_SECRET },
};

export function isOAuthProvider(value: string): value is OAuthProvider { return oauthProviders.includes(value as OAuthProvider); }
export function providerConfig(provider: OAuthProvider) { return configs[provider]; }

function stateSecret() { return process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ""; }
export function createOAuthState(userId: string, provider: OAuthProvider) {
  const payload = Buffer.from(JSON.stringify({ userId, provider, nonce: randomBytes(16).toString("hex"), iat: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyOAuthState(state: string) {
  const [payload, sig] = state.split(".");
  if (!payload || !sig || !stateSecret()) return null;
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId: string; provider: OAuthProvider; iat: number };
  if (Date.now() - data.iat > 10 * 60 * 1000 || !isOAuthProvider(data.provider)) return null;
  return data;
}

export function oauthRedirectUri() { return `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/integrations/oauth/callback`; }
export function buildAuthorizationUrl(provider: OAuthProvider, state: string) {
  const c = configs[provider];
  if (!c.clientId) throw new Error(`${provider} OAuth client is not configured.`);
  const url = new URL(c.auth);
  url.searchParams.set("client_id", c.clientId);
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", c.scopes.join(" "));
  if (provider === "gmail" || provider === "google_calendar" || provider === "google_sheets") { url.searchParams.set("access_type", "offline"); url.searchParams.set("prompt", "consent"); }
  return url.toString();
}

export async function exchangeCode(provider: OAuthProvider, code: string) {
  const c = configs[provider];
  if (!c.clientId || !c.clientSecret) throw new Error(`${provider} OAuth credentials are not configured.`);
  const params = new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, code, redirect_uri: oauthRedirectUri(), grant_type: "authorization_code" });
  const response = await fetch(c.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: params });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || `OAuth exchange failed for ${provider}.`);
  return data as { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string; scope?: string; workspace_id?: string; bot_id?: string };
}

export type { OAuthProvider };
