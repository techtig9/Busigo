import { createServerSupabase } from "@/lib/supabase/server";

export const BUSINESS_PHASES = [
  { id: 1, name: "Discover", description: "Capture the business, goals, team, customers and processes." },
  { id: 2, name: "Connect", description: "Connect the systems where business data and work already live." },
  { id: 3, name: "Automate", description: "Turn repetitive work into tested, observable workflows." },
  { id: 4, name: "Deploy AI Workforce", description: "Deploy specialist agents with permissions and human approvals." },
  { id: 5, name: "Measure & Grow", description: "Track outcomes, find opportunities and run growth experiments." },
  { id: 6, name: "Autonomous Operations", description: "Continuously monitor, recommend and safely execute approved work." },
] as const;

export async function getBusinessContext(workspaceId: string) {
  const supabase = createServerSupabase();
  const [{ data: business }, { data: goals }, { data: processes }, { data: agents }, { data: opportunities }, { data: approvals }, { data: kpis }] = await Promise.all([
    supabase.from("businesses").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("business_goals").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(20),
    supabase.from("business_processes").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("ai_agents").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: true }),
    supabase.from("automation_opportunities").select("*").eq("workspace_id", workspaceId).order("priority_score", { ascending: false }).limit(20),
    supabase.from("ai_approvals").select("*").eq("workspace_id", workspaceId).eq("status", "pending").order("created_at", { ascending: false }).limit(20),
    supabase.from("business_kpis").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(30),
  ]);
  return { business, goals: goals || [], processes: processes || [], agents: agents || [], opportunities: opportunities || [], approvals: approvals || [], kpis: kpis || [] };
}

export function opportunityScore(impact: string, effort: string, confidence = 0.8) {
  const impactMap: Record<string, number> = { low: 25, medium: 55, high: 80, critical: 100 };
  const effortMap: Record<string, number> = { low: 100, medium: 65, high: 30 };
  const impactValue = impactMap[impact] ?? 50;
  const effortValue = effortMap[effort] ?? 50;
  return Math.round(impactValue * 0.55 + effortValue * 0.25 + confidence * 100 * 0.2);
}
