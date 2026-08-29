import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { executeWorkflowRun } from "@/lib/engine/executor";
import { isRateLimited } from "@/lib/engine/rate-limit";
import { canUseFeature } from "@/lib/plans";
import type { FormField } from "@/types/database";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const supabase = createServiceRoleSupabase();

  const { data: form } = await supabase
    .from("forms")
    .select("id, workflow_id, workspace_id, fields, workflows!inner(id, user_id, workspace_id, definition, status, trigger_type)")
    .eq("slug", params.slug)
    .single();

  const workflow = (form as any)?.workflows;
  if (!form || !workflow || workflow.status !== "published" || workflow.trigger_type !== "form") {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  if (await isRateLimited(workflow.id)) {
    return NextResponse.json({ error: "Too many submissions — please try again shortly." }, { status: 429 });
  }

  const gate = await canUseFeature({ workspaceId: workflow.workspace_id, actingUserId: workflow.user_id, check: { action: "trigger_run" } });
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason }, { status: 402 });
  }

  const body = await request.json().catch(() => ({}));
  const fields = form.fields as FormField[];

  for (const field of fields) {
    if (field.required && (body[field.key] === undefined || body[field.key] === "")) {
      return NextResponse.json({ error: `"${field.label || field.key}" is required.` }, { status: 400 });
    }
  }

  const { data: run } = await supabase
    .from("workflow_runs")
    .insert({ workflow_id: workflow.id, workspace_id: workflow.workspace_id, trigger_source: "form", status: "running", trigger_payload: body })
    .select("id")
    .single();

  if (!run) return NextResponse.json({ error: "Could not submit form" }, { status: 500 });

  const result = await executeWorkflowRun({
    runId: run.id,
    workflowId: workflow.id,
    workspaceId: workflow.workspace_id,
    userId: workflow.user_id,
    definition: workflow.definition,
    triggerPayload: body,
  });

  return NextResponse.json({ ok: result.finalStatus !== "failed", status: result.finalStatus });
}
