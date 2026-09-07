import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { roleAtLeast, ROLE_LABELS } from "@/lib/workspace/roles";
import { listMembersAction, listInvitationsAction } from "@/lib/actions/workspace";
import { listApiKeysAction } from "@/lib/actions/api-keys";
import { listMfaFactorsAction } from "@/lib/actions/mfa";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SectionTabs, type Section } from "@/components/patterns/SectionTabs";
import { TeamCard, ApiKeysCard, MfaCard, SessionsCard } from "./WorkspaceSettingsPanel";
import { planLabel } from "@/lib/plans";

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

  const pendingInvites = (invitations as any[]).filter((i) => i.status === "pending").length;

  const general = (
    <div className="space-y-4">
      <Card>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>Everything in BusiGo belongs to a workspace — this one.</CardDescription>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-hairline p-3">
            <dt className="text-xs text-muted">Name</dt>
            <dd className="mt-1 truncate text-sm font-medium text-ink">{workspace.name}</dd>
          </div>
          <div className="rounded-lg border border-hairline p-3">
            <dt className="text-xs text-muted">Your role</dt>
            <dd className="mt-1">
              <Badge tone="signal">{ROLE_LABELS[role]}</Badge>
            </dd>
          </div>
          <div className="rounded-lg border border-hairline p-3">
            <dt className="text-xs text-muted">Plan</dt>
            <dd className="mt-1 text-sm font-medium text-ink">{planLabel((sub?.plan as any) || "free")}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Account behaviour</CardTitle>
        <CardDescription>Limits and defaults that apply to every workflow in this workspace.</CardDescription>
        <dl className="mt-3 divide-y divide-hairline text-sm">
          {[
            ["Failure alerts", "Always on. Any run that ends failed emails you, naming the step that failed."],
            [
              "Credit renewal",
              `Your ${planLabel((sub?.plan as any) || "free")} plan's credits reset at the start of each billing cycle; unused credits don't roll over.`,
            ],
            ["Trigger rate limit", "Each workflow accepts up to 30 triggers per minute, to protect your credits from a runaway loop."],
            ["Step cap", "A single run executes at most 25 steps."],
          ].map(([term, desc]) => (
            <div key={term} className="py-2.5">
              <dt className="font-semibold text-ink">{term}</dt>
              <dd className="mt-0.5 text-slate">{desc}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );

  const sections: Section[] = [
    { value: "general", label: "General", content: general },
    {
      value: "members",
      label: "Members",
      count: (members as any[]).length,
      content: <TeamCard canManage={canManage} members={members as any} invitations={invitations as any} />,
    },
    {
      value: "security",
      label: "Security",
      content: (
        <div className="space-y-4">
          <MfaCard factors={mfa.factors as any} />
          <SessionsCard />
        </div>
      ),
    },
  ];

  // API keys are Security-Admin-only. The tab is omitted entirely rather than shown disabled:
  // a visible-but-dead tab tells someone a capability exists and then refuses it, which is a
  // worse experience than not advertising it.
  if (canManageKeys) {
    sections.splice(2, 0, {
      value: "api",
      label: "API keys",
      count: (apiKeys as any[]).filter((k) => !k.revoked_at).length,
      content: <ApiKeysCard apiKeys={apiKeys as any} />,
    });
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description={`${workspace.name} · ${(members as any[]).length} member${(members as any[]).length === 1 ? "" : "s"}${
          pendingInvites ? ` · ${pendingInvites} pending invitation${pendingInvites === 1 ? "" : "s"}` : ""
        }`}
      />
      <SectionTabs sections={sections} />
    </>
  );
}
