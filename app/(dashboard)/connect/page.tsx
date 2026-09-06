import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { requestIntegrationAction, createDataSourceAction, queueSyncAction } from "@/lib/actions/connect";

export const dynamic = "force-dynamic";

const CATALOG = [
  { provider: "gmail", name: "Gmail", auth: "oauth", scopes: "email.read,email.send", capabilities: "email.read,email.send" },
  { provider: "google_calendar", name: "Google Calendar", auth: "oauth", scopes: "calendar.read,calendar.write", capabilities: "calendar.read,calendar.write" },
  { provider: "google_sheets", name: "Google Sheets", auth: "oauth", scopes: "sheets.read,sheets.write", capabilities: "records.read,records.write" },
  { provider: "slack", name: "Slack", auth: "oauth", scopes: "messages.read,messages.write", capabilities: "messages.read,messages.write" },
  { provider: "hubspot", name: "HubSpot", auth: "oauth", scopes: "crm.read,crm.write", capabilities: "contacts.read,deals.read,records.write" },
  { provider: "notion", name: "Notion", auth: "oauth", scopes: "pages.read,pages.write", capabilities: "knowledge.read,knowledge.write" },
  { provider: "airtable", name: "Airtable", auth: "api_key", scopes: "records.read,records.write", capabilities: "records.read,records.write" },
  { provider: "trello", name: "Trello", auth: "api_key", scopes: "boards.read,cards.write", capabilities: "tasks.read,tasks.write" },
];

export default async function ConnectPage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: integrations }, { data: sources }, { data: analyses }, { data: syncs }] = await Promise.all([
    supabase.from("integration_accounts").select("*").eq("workspace_id", workspace.id).order("updated_at", { ascending: false }),
    supabase.from("business_data_sources").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }),
    supabase.from("website_analyses").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(10),
    supabase.from("integration_sync_runs").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const connected = new Map((integrations || []).map((x) => [x.provider, x]));
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-signal">Phase 2 · Connect</p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Connect your business</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate">Bring your apps, website and business documents into BusiGo&apos;s unified business data layer. Connections are permission-scoped and every sync gets a status trail.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(CATALOG).map((item) => {
          const row = connected.get(item.provider);
          return <Card key={item.provider} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink">{item.name}</h2><p className="mt-1 text-xs text-slate">{item.auth.toUpperCase()} · {item.capabilities.split(",").length} capabilities</p></div><Badge tone={row?.status === "connected" ? "good" : row?.status === "syncing" ? "warn" : "neutral"}>{row?.status || "Not connected"}</Badge></div>
            <div className="mt-auto">
              {row ? <form action={queueSyncAction.bind(null, row.id)}><Button type="submit" variant="secondary">Sync now</Button></form> : <form action={requestIntegrationAction}><input type="hidden" name="provider" value={item.provider}/><input type="hidden" name="display_name" value={item.name}/><input type="hidden" name="auth_type" value={item.auth}/><input type="hidden" name="scopes" value={item.scopes}/><input type="hidden" name="capabilities" value={item.capabilities}/><Button type="submit">Set up connection</Button></form>}
            </div>
          </Card>;
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card><div className="mb-5"><h2 className="text-lg font-bold text-ink">Business data sources</h2><p className="text-sm text-slate">Add a website or manually register a source for the Business Brain.</p></div><form action={createDataSourceAction} className="space-y-3"><select name="source_type" className="w-full rounded border border-hairline bg-panel px-3 py-2 text-sm"><option value="website">Website</option><option value="manual">Manual source</option><option value="document">Document metadata</option></select><input name="name" required placeholder="Source name" className="w-full rounded border border-hairline bg-panel px-3 py-2 text-sm"/><input name="url" placeholder="https://yourbusiness.com" className="w-full rounded border border-hairline bg-panel px-3 py-2 text-sm"/><Button type="submit">Add source</Button></form><div className="mt-6 space-y-2">{(sources || []).slice(0,5).map((s) => <div key={s.id} className="flex items-center justify-between rounded border border-hairline p-3"><div><p className="text-sm font-semibold text-ink">{s.name}</p><p className="text-xs text-slate">{s.source_type}{s.url ? ` · ${s.url}` : ""}</p></div><Badge tone={s.status === "ready" ? "good" : s.status === "error" ? "bad" : "warn"}>{s.status}</Badge></div>)}</div></Card>
        <Card><div className="mb-5"><h2 className="text-lg font-bold text-ink">Website intelligence</h2><p className="text-sm text-slate">Website sources are queued for structured analysis: pages, products, services, FAQs, positioning and conversion opportunities.</p></div><div className="space-y-3">{(analyses || []).length ? analyses!.map((a) => <div key={a.id} className="rounded border border-hairline p-3"><div className="flex justify-between"><p className="text-sm font-semibold text-ink">{a.url}</p><Badge tone={a.status === "ready" ? "good" : "warn"}>{a.status}</Badge></div><p className="mt-1 text-xs text-slate">{a.pages_processed}/{a.pages_discovered} pages processed</p></div>) : <p className="text-sm text-slate">No website analysis queued yet. Add your website above.</p>}</div><div className="mt-6 rounded bg-surface p-4 text-xs leading-5 text-slate">Provider authentication is intentionally permission-scoped. This phase establishes the integration, ingestion and sync architecture; provider OAuth/API credentials must be configured before live external API traffic is enabled.</div></Card>
      </section>

      <Card><h2 className="text-lg font-bold text-ink">Sync activity</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase text-slate"><tr><th className="pb-2">Status</th><th>Records</th><th>Created</th><th>Updated</th><th>Started</th></tr></thead><tbody>{(syncs || []).map((s) => <tr key={s.id} className="border-t border-hairline"><td className="py-3">{s.status}</td><td>{s.records_seen}</td><td>{s.records_created}</td><td>{s.records_updated}</td><td>{s.started_at ? new Date(s.started_at).toLocaleString() : "Queued"}</td></tr>)}</tbody></table>{!(syncs || []).length && <p className="py-4 text-sm text-slate">No sync runs yet.</p>}</div></Card>
    </div>
  );
}
