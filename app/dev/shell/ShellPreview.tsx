"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/States";
import { Workflow } from "lucide-react";

// Representative, obviously-fake data. Nothing here reaches a database.
const NOTIFICATIONS = [
  {
    id: "1",
    title: "Workflow failed: Lead qualification",
    body: "Step 3 (AI Qualify) returned a provider error.",
    link: "/runs",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: "2",
    title: "Approval requested",
    body: "Outbound email to 42 contacts is waiting for review.",
    link: "/approvals",
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: "3",
    title: "Credits running low",
    body: "You have used 82% of this cycle's allowance.",
    link: "/billing",
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];

const WORKSPACE = { id: "ws_1", name: "Acme Operations", is_personal: false, role: "owner" as const };

export function ShellPreview({ initialSidebarCollapsed }: { initialSidebarCollapsed?: boolean }) {
  return (
    <AppShell
      isAdmin
      initialSidebarCollapsed={initialSidebarCollapsed}
      userName="Saad Ali"
      plan="growth"
      notifications={NOTIFICATIONS}
      currentWorkspace={WORKSPACE}
      workspaceOptions={[WORKSPACE, { id: "ws_2", name: "Personal", is_personal: true, role: "owner" as const }]}
    >
      <PageHeader
        title="Command Center"
        description="Shell preview — grouped sidebar, ⌘K palette, breadcrumbs, mobile bottom bar."
        actions={
          <>
            <Button variant="secondary">Invite teammate</Button>
            <Button>New workflow</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active workflows", value: "12", tone: "success" as const, status: "published" },
          { label: "Runs today", value: "1,284", tone: "pulse" as const, status: "running" },
          { label: "Open approvals", value: "3", tone: "warn" as const, status: "waiting" },
          { label: "Credits left", value: "18,402", tone: "slate" as const, status: "draft" },
        ].map((m) => (
          <Card key={m.label} density="compact">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate">{m.label}</p>
            <p className="tabular mt-1 text-2xl font-bold text-ink">{m.value}</p>
            <div className="mt-2">
              <StatusBadge status={m.status} tone={m.tone} />
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Representative rows, for layout only.</CardDescription>
          <ul className="mt-3 divide-y divide-hairline">
            {["Lead qualification", "Invoice follow-up", "Weekly digest", "Churn watch"].map((n, i) => (
              <li key={n} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-ink">{n}</span>
                <StatusBadge status={["success", "running", "failed", "waiting"][i]} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Plan</CardTitle>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="signal">Growth</Badge>
            <span className="text-xs text-muted">renews in 12 days</span>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <EmptyState
          icon={Workflow}
          title="No opportunities yet"
          body="BusiGo surfaces opportunities once Business Brain has enough context about how your business operates."
          action={{ label: "Open Business Brain", href: "#" }}
          aiAction={{ label: "Scan with AI", href: "#" }}
        />
      </Card>
    </AppShell>
  );
}
