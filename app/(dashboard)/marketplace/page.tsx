import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { installMarketplaceApp } from "@/lib/actions/marketplace";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();
  const [{ data: apps }, { data: installs }] = await Promise.all([
    supabase.from("marketplace_apps").select("id, slug, name, description, category, publisher, pricing_model, required_plan, capabilities").eq("status", "published").order("name"),
    supabase.from("marketplace_installations").select("app_id, status").eq("workspace_id", workspace.id),
  ]);
  const installed = new Set((installs || []).filter(i => i.status === "installed").map(i => i.app_id));
  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold text-ink">App Marketplace</h1><p className="mt-1 text-sm text-slate">Discover approved business connectors and extend your BusiGo workforce.</p></div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {(apps || []).map(app => <Card key={app.id}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-ink">{app.name}</h2><p className="text-xs text-slate">{app.publisher} · {app.category}</p></div><Badge tone="signal">{app.pricing_model}</Badge></div>
        <p className="mt-3 text-sm text-slate">{app.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">{(app.capabilities || []).map((c: string) => <Badge key={c}>{c}</Badge>)}</div>
        <div className="mt-4 flex items-center justify-between"><span className="text-xs text-slate">Requires {app.required_plan || "any plan"}</span>{installed.has(app.id) ? <Badge tone="signal">Installed</Badge> : <form action={installMarketplaceApp}><input type="hidden" name="appId" value={app.id}/><Button type="submit" variant="secondary">Install</Button></form>}</div>
      </Card>)}
    </div>
  </div>;
}
