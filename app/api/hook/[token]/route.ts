import { createServiceRoleSupabase } from "@/lib/supabase/server";
import { executeWorkflowRun } from "@/lib/engine/executor";
import { isRateLimited } from "@/lib/engine/rate-limit";
import { canUseFeature } from "@/lib/plans";
import { claimIdempotency, saveIdempotentResponse, hashRequest } from "@/lib/platform/reliability";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: NextRequest, token: string) {
  const supabase = createServiceRoleSupabase();

  const { data: workflow } = await supabase
    .from("workflows")
    .select("id, user_id, workspace_id, definition, status, trigger_type")
    .eq("trigger_token", token)
    .single();

  if (!workflow || workflow.status !== "published" || workflow.trigger_type !== "webhook") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (await isRateLimited(workflow.id)) {
    return NextResponse.json({ error: "Rate limit exceeded — too many triggers in the last minute." }, { status: 429 });
  }

  let body: any = {};
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      body = await request.json();
    } catch {
      body = {};
    }
  } else if (request.method !== "GET") {
    try {
      body = { raw: await request.text() };
    } catch {
      body = {};
    }
  }

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const triggerPayload = { ...query, ...body };

  // Opt-in idempotency: if the caller sends an Idempotency-Key header (Stripe/GitHub-style —
  // many webhook senders retry on timeout or a slow 2xx and expect this), a repeat delivery
  // with the same key AND the same payload returns the original run's result instead of
  // executing the workflow again. A caller that never sends the header always executes,
  // unchanged from before — this activates previously-unused infrastructure
  // (lib/platform/reliability.ts, built in an earlier phase, never wired to anything).
  const idempotencyKey = request.headers.get("idempotency-key");
  const requestHash = hashRequest(triggerPayload);
  if (idempotencyKey) {
    try {
      const cached = await claimIdempotency(workflow.user_id, idempotencyKey, requestHash);
      if (cached?.response_status) {
        return NextResponse.json(cached.response_body, { status: cached.response_status });
      }
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
  }

  const gate = await canUseFeature({ workspaceId: workflow.workspace_id, actingUserId: workflow.user_id, check: { action: "trigger_run" } });
  if (!gate.allowed) {
    const response = { error: gate.reason };
    if (idempotencyKey) await saveIdempotentResponse(workflow.user_id, idempotencyKey, 402, response);
    return NextResponse.json(response, { status: 402 });
  }

  const { data: run } = await supabase
    .from("workflow_runs")
    .insert({ workflow_id: workflow.id, workspace_id: workflow.workspace_id, trigger_source: "webhook", status: "running", trigger_payload: triggerPayload })
    .select("id")
    .single();

  if (!run) {
    return NextResponse.json({ error: "Could not start run" }, { status: 500 });
  }

  const result = await executeWorkflowRun({
    runId: run.id,
    workflowId: workflow.id,
    workspaceId: workflow.workspace_id,
    userId: workflow.user_id,
    definition: workflow.definition,
    triggerPayload,
  });

  const responseBody = result.webhookResponse?.body ?? { ok: result.finalStatus === "success", runId: run.id, status: result.finalStatus };
  const responseStatus = result.webhookResponse?.statusCode ?? 200;

  if (idempotencyKey) await saveIdempotentResponse(workflow.user_id, idempotencyKey, responseStatus, responseBody);
  return NextResponse.json(responseBody, { status: responseStatus });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  return handle(request, params.token);
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  return handle(request, params.token);
}
