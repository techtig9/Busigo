import { createServerSupabase } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { planLabel } from "@/lib/plans";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { roleAtLeast } from "@/lib/workspace/roles";
import { listMembersAction, listInvitationsAction } from "@/lib/actions/workspace";
import { listApiKeysAction } from "@/lib/actions/api-keys";
import { listMfaFactorsAction } from "@/lib/actions/mfa";
import { WorkspaceSettingsPanel } from "./WorkspaceSettingsPanel";
import { PageHeader } from "@/components/layout/PageHeader";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { role, workspace } = await getWorkspaceContext();
  const { data: sub } = await supabase.from("subscriptions").select("plan").eq("workspace_id", workspace.id).single();
  const canManage = roleAtLeast(role, "admin");
  const canManageKeys = roleAtLeast(role, "security_admin");

  const [members, invitations, apiKeys, mfa] = await Promise.all([
    listMembersAction(),
    listInvitationsAction(),
    canManageKeys ? listApiKeysAction() : Promise.resolve([]),
    listMfaFactorsAction(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <WorkspaceSettingsPanel
        canManage={canManage}
        members={members as any}
        invitations={invitations as any}
        apiKeys={apiKeys as any}
        mfaFactors={mfa.factors as any}
      />

      <Card>
        <h2 className="font-bold text-ink">Account behavior</h2>
        <ul className="mt-3 space-y-3 text-sm text-slate">
          <li>
            <span className="font-semibold text-ink">Failure alerts —</span> always on. Any run that ends failed
            emails you, naming the step that failed.
          </li>
          <li>
            <span className="font-semibold text-ink">Credit renewal —</span> your {planLabel((sub?.plan as any) || "free")} plan&apos;s
            credits reset at the start of each billing cycle; unused credits don&apos;t roll over.
          </li>
          <li>
            <span className="font-semibold text-ink">Trigger rate limit —</span> each workflow accepts up to 30
            triggers per minute, to protect your credits from a runaway loop.
          </li>
          <li>
            <span className="font-semibold text-ink">Step cap —</span> a single run executes at most 25 steps.
          </li>
        </ul>
      </Card>
    </div>
  );
}
