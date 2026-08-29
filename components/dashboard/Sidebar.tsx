"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Command Center" },
  { href: "/business-brain", label: "Business Brain" },
  { href: "/opportunities", label: "AI Opportunities" },
  { href: "/workforce", label: "AI Workforce" },
  { href: "/agent-orchestration", label: "Agent Orchestration" },
  { href: "/approvals", label: "Approvals" },
  { href: "/insights", label: "Insights" },
  { href: "/business-intelligence", label: "Business Intelligence" },
  { href: "/growth", label: "Measure & Grow" },
  { href: "/growth-engine", label: "Advanced Growth" },
  { href: "/automation-center", label: "Automation Center" },
  { href: "/autonomous-ops", label: "Autonomous Ops" },
  { href: "/ai-studio", label: "AI Studio" },
  { href: "/security-governance", label: "Security & Governance" },
  { href: "/scale-reliability", label: "Scale & Reliability" },
  { href: "/marketplace", label: "App Marketplace" },
  { href: "/workflows", label: "Workflows" },
  { href: "/runs", label: "Runs" },
  { href: "/connect", label: "Connect & Data" },
  { href: "/connections", label: "Connections" },
  { href: "/forms", label: "Forms" },
  { href: "/settings", label: "Settings" },
  { href: "/billing", label: "Billing" },
  { href: "/profile", label: "Profile" },
  { href: "/help", label: "Help" },
];

export function SidebarLinks({ isAdmin, onNavigate }: { isAdmin?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      <Link href="/dashboard" className="mb-4 px-2 text-lg font-bold text-ink" onClick={onNavigate}>
        {APP_NAME}
      </Link>
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "rounded px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-signal/10 text-signal" : "text-slate hover:bg-surface hover:text-ink"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            "rounded px-3 py-2 text-sm font-semibold transition-colors",
            pathname.startsWith("/admin") ? "bg-signal/10 text-signal" : "text-slate hover:bg-surface hover:text-ink"
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  );
}

export function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-hairline bg-panel md:flex md:flex-col">
      <SidebarLinks isAdmin={isAdmin} />
    </aside>
  );
}
