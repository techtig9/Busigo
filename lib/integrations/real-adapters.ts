import type { IntegrationProvider, IntegrationResult } from "./types";

async function jsonFetch(url: string, init: RequestInit): Promise<any> { const r = await fetch(url, init); const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error_description || data.message || data.error || `Provider request failed (${r.status})`); return data; }
const auth = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
export async function executeReal(provider: IntegrationProvider, token: string, operation: string, input: Record<string, unknown>): Promise<IntegrationResult> {
  try {
    let data: unknown;
    if (provider === "slack" && operation === "send_message") data = await jsonFetch("https://slack.com/api/chat.postMessage", { method: "POST", headers: auth(token), body: JSON.stringify({ channel: input.channel, text: input.text }) });
    else if (provider === "gmail" && operation === "send_email") { const raw = [`To: ${input.to}`, `Subject: ${input.subject}`, "Content-Type: text/plain; charset=utf-8", "", String(input.body || "")].join("\\r\\n"); data = await jsonFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: auth(token), body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }) }); }
    else if (provider === "google_calendar" && operation === "create_event") data = await jsonFetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: auth(token), body: JSON.stringify({ summary: input.summary, description: input.description, start: { dateTime: input.start }, end: { dateTime: input.end } }) });
    else if (provider === "google_sheets" && operation === "append_values") { const range = encodeURIComponent(String(input.range || "Sheet1!A:Z")); data = await jsonFetch(`https://sheets.googleapis.com/v4/spreadsheets/${input.spreadsheet_id}/values/${range}:append?valueInputOption=USER_ENTERED`, { method: "POST", headers: auth(token), body: JSON.stringify({ values: input.values }) }); }
    else if (provider === "hubspot" && operation === "create_contact") data = await jsonFetch("https://api.hubapi.com/crm/v3/objects/contacts", { method: "POST", headers: auth(token), body: JSON.stringify({ properties: input.properties }) });
    else if (provider === "notion" && operation === "create_page") data = await jsonFetch("https://api.notion.com/v1/pages", { method: "POST", headers: { ...auth(token), "Notion-Version": "2022-06-28" }, body: JSON.stringify({ parent: { database_id: input.database_id }, properties: input.properties, children: input.children }) });
    else if (provider === "airtable" && operation === "create_record") data = await jsonFetch(`https://api.airtable.com/v0/${input.base_id}/${encodeURIComponent(String(input.table))}`, { method: "POST", headers: auth(token), body: JSON.stringify({ fields: input.fields }) });
    else return { ok: false, provider, operation, error: "Unsupported provider operation." };
    return { ok: true, provider, operation, data };
  } catch (error) { return { ok: false, provider, operation, error: error instanceof Error ? error.message : "Provider execution failed" }; }
}
