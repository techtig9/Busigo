import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Brain,
  Lightbulb,
  Sparkles,
  Workflow,
  Wand2,
  FileText,
  Bot,
  Network,
  CheckSquare,
  Activity,
  ShieldCheck,
  BarChart3,
  Database,
  TrendingUp,
  Target,
  Plug,
  Blocks,
  Lock,
  Gauge,
  CreditCard,
  Settings,
  LifeBuoy,
  User,
  Shield,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra words that should match this item in the command palette but aren't in the label. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * The dashboard's grouped navigation — a single source of truth shared by the sidebar, the
 * mobile navigation and the command palette, so those three can never drift apart.
 *
 * Grouping is mandated by spec §11 ("the current flat sidebar is too long"): 25 flat links
 * with no hierarchy gave every destination equal weight and forced linear scanning. The six
 * groups follow the product's own verbs — understand, build, operate, measure, connect,
 * administer.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Command",
    items: [
      { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, keywords: "home overview kpi" },
      { href: "/business-brain", label: "Business Brain", icon: Brain, keywords: "context goals rules kpis identity" },
      { href: "/opportunities", label: "AI Opportunities", icon: Lightbulb, keywords: "ideas impact effort backlog" },
    ],
  },
  {
    label: "Build",
    items: [
      { href: "/ai-studio", label: "AI Studio", icon: Sparkles, keywords: "providers models routing playground prompts" },
      { href: "/workflows", label: "Workflows", icon: Workflow, keywords: "automation builder canvas steps" },
      { href: "/automation-center", label: "Automation Center", icon: Wand2, keywords: "architect generate plan simulate" },
      { href: "/forms", label: "Forms", icon: FileText, keywords: "public form submissions fields" },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/workforce", label: "AI Workforce", icon: Bot, keywords: "agents specialists tasks permissions" },
      { href: "/agent-orchestration", label: "Agent Orchestration", icon: Network, keywords: "plan graph mission control" },
      { href: "/approvals", label: "Approvals", icon: CheckSquare, keywords: "review approve reject risk queue" },
      { href: "/runs", label: "Runs", icon: Activity, keywords: "executions history logs traces failures" },
      { href: "/autonomous-ops", label: "Autonomous Ops", icon: ShieldCheck, keywords: "autonomy policy incidents alerts" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "Insights", icon: BarChart3, keywords: "analytics briefing metrics trends" },
      { href: "/business-intelligence", label: "Business Intelligence", icon: Database, keywords: "digital twin entities anomalies" },
      { href: "/growth", label: "Measure & Grow", icon: TrendingUp, keywords: "experiments outcomes roi" },
      { href: "/growth-engine", label: "Advanced Growth", icon: Target, keywords: "growth plans campaigns" },
    ],
  },
  {
    label: "Connect",
    items: [
      { href: "/connect", label: "Connect & Data", icon: Plug, keywords: "website documents sources ingest" },
      { href: "/connections", label: "Connections", icon: Plug, keywords: "gmail slack hubspot notion airtable oauth integrations" },
      { href: "/marketplace", label: "App Marketplace", icon: Blocks, keywords: "apps install catalog extensions" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/security-governance", label: "Security & Governance", icon: Lock, keywords: "audit policies api keys sessions mfa" },
      { href: "/scale-reliability", label: "Scale & Reliability", icon: Gauge, keywords: "queue jobs retries dead letter uptime" },
      { href: "/billing", label: "Billing", icon: CreditCard, keywords: "plan invoice credits upgrade payment paddle" },
      { href: "/settings", label: "Settings", icon: Settings, keywords: "workspace members roles invitations api" },
      { href: "/support", label: "Help & Support", icon: LifeBuoy, keywords: "help docs faq contact support ticket" },
    ],
  },
];

/** Shown only to admins, kept out of the main groups (spec §11: "Admin is separate"). */
export const ADMIN_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
  keywords: "internal control plane users workspaces subscriptions",
};

/** Reachable destinations that aren't in the sidebar but should be findable via ⌘K. */
export const EXTRA_NAV_ITEMS: NavItem[] = [
  { href: "/profile", label: "Profile", icon: User, keywords: "account name avatar timezone theme password" },
  { href: "/workflows/new", label: "New workflow", icon: Workflow, keywords: "create add build automation" },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items).concat(EXTRA_NAV_ITEMS);

/**
 * Whether a nav href should render as the active route.
 *
 * Prefix matching alone is wrong here: "/workflows" would light up while you're on
 * "/workflows/new", which is fine, but plain `startsWith` would also make "/connect" match
 * "/connections" — two different destinations that both exist in this app. Matching on a
 * path *segment* boundary avoids that.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

/** Human-readable label for a path segment, used by Breadcrumbs. */
export function segmentLabel(segment: string, fullPath: string): string {
  const known = ALL_NAV_ITEMS.find((i) => i.href === fullPath);
  if (known) return known.label;
  if (ADMIN_ITEM.href === fullPath) return ADMIN_ITEM.label;
  // Ids (uuids, tokens) shouldn't be rendered raw in a breadcrumb.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment) || segment.length > 24) return "Detail";
  return segment
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
