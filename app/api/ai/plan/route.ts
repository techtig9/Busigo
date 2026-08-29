import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { runBusinessAI } from "@/lib/ai/provider";
import { getWorkspaceContext } from "@/lib/workspace/context";

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { workspace } = await getWorkspaceContext();

    const body = await request.json();
    const task = String(body.task || "").trim();
    if (!task) return NextResponse.json({ error: "task is required" }, { status: 400 });
    const { data: brain } = await supabase.from("businesses").select("*").eq("workspace_id", workspace.id).maybeSingle();
    const ai = await runBusinessAI({
      task,
      context: { business: brain ?? {}, user_id: user.id },
      schema: { summary: "string", steps: [{ type: "trigger|ai|action|delay|approval", name: "string", risk: "low|medium|high|critical" }], assumptions: ["string"], requires_approval: true },
      workspaceId: workspace.id,
    });
    // Per-attempt logging (including any providers that failed over before this one
    // succeeded) now happens inside runBusinessAI itself — see lib/ai/observability.ts —
    // so there's no separate ai_provider_events insert needed here anymore.
    return NextResponse.json({ ...ai.result, _ai: { provider: ai.provider, model: ai.model, attempts: ai.attempts } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI request failed" }, { status: 500 });
  }
}
