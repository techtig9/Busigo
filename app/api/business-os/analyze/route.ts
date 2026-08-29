import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { opportunityScore } from "@/lib/business-os";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: business }, { data: answers }] = await Promise.all([
    supabase.from("businesses").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("business_discovery_answers").select("question_key, answer").eq("user_id", user.id),
  ]);
  if (!business) return NextResponse.json({ error: "Complete Business Brain first." }, { status: 400 });

  const answerKeys = new Set((answers || []).map((a: any) => a.question_key));
  const candidates = [
    { key: "lead_followup", title: "Automate lead follow-up", description: "Respond quickly, qualify leads and create follow-up tasks when a lead arrives.", agent: "sales", impact: "high", effort: "low" },
    { key: "customer_onboarding", title: "Automate customer onboarding", description: "Create onboarding tasks, welcome messages and internal handoffs after a sale.", agent: "operations", impact: "high", effort: "medium" },
    { key: "support_triage", title: "Automate support triage", description: "Classify inbound support conversations, draft safe responses and escalate sensitive requests.", agent: "support", impact: "high", effort: "medium" },
    { key: "reporting", title: "Automate recurring reporting", description: "Collect KPI data and prepare daily, weekly and monthly management reports.", agent: "analytics", impact: "medium", effort: "low" },
    { key: "bottleneck", title: "Remove the biggest repetitive-work bottleneck", description: "Turn the process identified in the discovery interview into a measurable workflow.", agent: "operations", impact: "critical", effort: "medium" },
  ];
  const relevant = candidates.filter((c) => c.key === "bottleneck" || (c.key === "lead_followup" && answerKeys.has("lead_flow")) || (c.key === "customer_onboarding" && answerKeys.has("customer_delivery")) || (c.key === "support_triage" && answerKeys.has("support")) || (c.key === "reporting" && answerKeys.has("reporting")));
  const { data: existing } = await supabase.from("automation_opportunities").select("title").eq("user_id", user.id);
  const existingTitles = new Set((existing || []).map((x: any) => x.title));
  const rows = relevant.filter((c) => !existingTitles.has(c.title)).map((c) => ({ user_id: user.id, title: c.title, description: c.description, source: "business-analyzer", impact: c.impact, effort: c.effort, priority_score: opportunityScore(c.impact, c.effort), recommended_agent: c.agent, status: "identified" }));
  if (rows.length) {
    const { error } = await supabase.from("automation_opportunities").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await supabase.from("business_events").insert({ user_id: user.id, event_type: "business.analyzed", source: "busiGo", entity_type: "business", entity_id: business.id, payload: { created: rows.length } });
  return NextResponse.json({ created: rows.length, summary: rows.length ? "Prioritized opportunities are ready for review." : "No new opportunities were needed." });
}
