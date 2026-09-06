import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PLAN_CREDITS, CREDIT_TOPUPS, planLabel } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { PlanCards } from "./PlanCards";
import { BuyCreditsButton } from "./BuyCreditsButton";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { roleAtLeast } from "@/lib/workspace/roles";
import type { Plan } from "@/types/database";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { workspace, role } = await getWorkspaceContext();
  const canManageBilling = roleAtLeast(role, "billing_admin") || roleAtLeast(role, "admin");

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, credits_remaining, renews_at")
    .eq("workspace_id", workspace.id)
    .single();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, status, created_at")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  const plan = (sub?.plan as Plan) || "free";
  const creditsTotal = PLAN_CREDITS[plan];
  const pct = creditsTotal > 0 ? Math.min(100, Math.round(((sub?.credits_remaining ?? 0) / creditsTotal) * 100)) : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="{workspace.name}&apos;s plan and credits — shared by every member of this workspace." />

      <Card className="transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate">Current plan</p>
            <p className="mt-1 text-xl font-bold text-ink">{planLabel(plan)}</p>
          </div>
          <Badge tone={sub?.status === "active" ? "signal" : "warn"}>{sub?.status || "active"}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate">
          {sub?.credits_remaining?.toLocaleString() ?? 0} / {creditsTotal.toLocaleString()} credits remaining
          {sub?.renews_at && ` · renews ${formatDate(sub.renews_at)}`}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-surface">
          <div className="h-1.5 rounded-full bg-signal transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {!canManageBilling && (
        <p className="rounded border border-hairline bg-surface px-4 py-3 text-sm text-slate">
          You can see this workspace&apos;s plan and usage, but only an Owner, Admin, or Billing Admin can change the plan or buy credits.
        </p>
      )}

      {canManageBilling && (
        <>
          <Card>
            <h2 className="mb-3 font-bold text-ink">Plans</h2>
            <PlanCards currentPlan={plan} userId={user.id} workspaceId={workspace.id} />

            <div className="mt-4 flex items-center justify-between rounded border border-dashed border-hairline p-4">
              <div>
                <p className="font-semibold text-ink">Enterprise</p>
                <p className="mt-0.5 text-xs text-slate">Custom credits, SSO, dedicated support and an SLA — priced per account.</p>
              </div>
              <Button href="mailto:techtig9@gmail.com?subject=busigo%20Enterprise" variant="secondary">
                Contact sales
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-1 font-bold text-ink">Buy extra credits</h2>
            <p className="mb-3 text-xs text-slate">Available any time your monthly allocation runs out — doesn&apos;t change your plan.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {CREDIT_TOPUPS.map((pack) => (
                <div
                  key={pack.credits}
                  className="rounded border border-hairline p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-pulse hover:shadow-md"
                >
                  <p className="text-lg font-bold text-ink">{pack.credits.toLocaleString()}</p>
                  <p className="text-xs text-slate">credits</p>
                  <p className="mt-1 text-sm text-ink">${pack.priceUsd.toFixed(2)}</p>
                  <div className="mt-3">
                    <BuyCreditsButton credits={pack.credits} userId={user.id} workspaceId={workspace.id} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Card>
        <h2 className="mb-3 font-bold text-ink">Payment history</h2>
        {!payments || payments.length === 0 ? (
          <p className="text-sm text-slate">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{formatDate(p.created_at)}</span>
                <span className="text-ink">${Number(p.amount || 0).toFixed(2)}</span>
                <Badge tone={p.status === "completed" ? "signal" : "danger"}>{p.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
