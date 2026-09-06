import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PLAN_LIMITS } from "@/lib/plans";
import type { ConnectionService, Plan } from "@/types/database";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { QueueButton } from "./QueueButton";

export const dynamic = "force-dynamic";

const SERVICES: { id: ConnectionService; name: string }[] = [
  { id: "slack", name: "Slack" },
  { id: "google_sheets", name: "Google Sheets" },
  { id: "gmail", name: "Gmail" },
  { id: "google_calendar", name: "Google Calendar" },
  { id: "airtable", name: "Airtable" },
  { id: "hubspot", name: "HubSpot" },
  { id: "trello", name: "Trello" },
  { id: "notion", name: "Notion" },
];

export default async function ConnectionsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { workspace } = await getWorkspaceContext();

  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("workspace_id", workspace.id).single();
  // connections itself is still user_id-scoped, not workspace_id — one of the action files
  // noted as "not yet converted" in the Phase 1/3 reports; only the plan-gate check above
  // (which drives real behavior — whether app connections are allowed at all) was converted.
  const { data: connections } = await supabase.from("connections").select("service, status").eq("user_id", user.id);

  const plan = (sub?.plan as Plan) || "free";
  const allowed = PLAN_LIMITS[plan].appConnections;
  const queuedServices = new Set((connections || []).map((c) => c.service));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Connections</h1>
        <p className="mt-1 text-sm text-slate">
          Real app connections are on the near-term roadmap (Phase 2). Join the waitlist for the ones you need and
          we&apos;ll notify you when they&apos;re live.
          {!allowed && " App connections require the Pro plan."}
        </p>
      </div>
      <Card>
        <ul className="divide-y divide-hairline">
          {SERVICES.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3">
              <span className="text-sm font-semibold text-ink">{s.name}</span>
              {queuedServices.has(s.id) ? (
                <Badge tone="warn">Queued</Badge>
              ) : (
                <QueueButton service={s.id} disabled={!allowed} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
