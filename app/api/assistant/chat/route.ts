import { createServerSupabase } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace/context";
import { PLAN_CREDITS, PLAN_PRICE_USD, planLabel } from "@/lib/plans";
import { runBusinessAIStream, type ChatMessage } from "@/lib/ai/provider";
import type { Plan } from "@/types/database";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface EvidenceItem {
  type: "workflow" | "run";
  id: string;
  label: string;
  href: string;
}

async function buildAccountContext(workspaceId: string, userId: string) {
  const supabase = createServerSupabase();

  const [{ data: profile }, { data: sub }, { data: workflows }, { data: recentRuns }] = await Promise.all([
    supabase.from("users").select("name").eq("id", userId).single(),
    supabase.from("subscriptions").select("plan, credits_remaining").eq("workspace_id", workspaceId).single(),
    supabase.from("workflows").select("id, name, status, trigger_type, definition").eq("workspace_id", workspaceId),
    supabase
      .from("workflow_runs")
      .select("id, status, started_at, workflow_id, workflows!inner(name, workspace_id)")
      .eq("workflows.workspace_id", workspaceId)
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const plan = (sub?.plan as Plan) || "free";
  const creditsTotal = PLAN_CREDITS[plan] ?? 0;
  const creditsRemaining = sub?.credits_remaining ?? 0;

  const workflowSummaries = (workflows || []).map(
    (w: any) => `- "${w.name}" (id: ${w.id}, ${w.status}, ${w.trigger_type} trigger, ${(w.definition || []).length} steps)`
  );

  const runs = recentRuns || [];
  const failed = runs.filter((r: any) => r.status === "failed");
  const failureRate = runs.length > 0 ? Math.round((failed.length / runs.length) * 100) : 0;
  const mostRecentFailure = failed[0] as any;

  const evidence: EvidenceItem[] = [
    ...(workflows || []).slice(0, 5).map((w: any): EvidenceItem => ({ type: "workflow", id: w.id, label: w.name, href: `/workflows/${w.id}` })),
    ...(mostRecentFailure ? [{ type: "run" as const, id: mostRecentFailure.id, label: `Failed run — ${mostRecentFailure.workflows?.name ?? "workflow"}`, href: `/runs/${mostRecentFailure.workflow_id}` }] : []),
  ];

  const context = `
Account context (real data, gathered just now — use it, don't guess; every workflow below has its id in parentheses so you can refer to a specific one by name):
- User's name: ${profile?.name || "unknown"}
- Plan: ${planLabel(plan)}${PLAN_PRICE_USD[plan] != null ? ` ($${PLAN_PRICE_USD[plan]}/mo)` : ""}
- Credits: ${creditsRemaining.toLocaleString()} remaining of ${creditsTotal.toLocaleString()} this cycle (${creditsTotal > 0 ? Math.round((creditsRemaining / creditsTotal) * 100) : 0}% left)
- Workflows (${workflows?.length ?? 0} total):
${workflowSummaries.length ? workflowSummaries.join("\n") : "  (none yet)"}
- Last ${runs.length} runs: ${failed.length} failed (${failureRate}% failure rate)${
    mostRecentFailure ? `, most recent failure was on "${mostRecentFailure.workflows?.name}"` : ""
  }
`.trim();

  return { context, evidence };
}

const SYSTEM_PROMPT = `You are the busigo Assistant, a helpful in-app guide for busigo — an AI-powered business
process automation platform (trigger -> ordered list of steps: HTTP Request, Send Email, Delay,
Filter, Transform Data, AI Action, Webhook Response).

Your job is to help the signed-in user understand their account and make good decisions:
explain what's happening in their workflows and runs, suggest fixes when something is failing,
recommend when upgrading plan or buying credit top-ups would actually help (only when it
genuinely would — never push an upgrade that wouldn't help their stated problem), and explain
how credits, steps, and triggers work.

Ground every specific claim about the user's own account in the "Account context" block you're
given — never invent workflow names, run counts, or credit numbers that aren't in it. If
something isn't in the context, say you don't have that detail rather than guessing.

You are advisory only: you cannot create, edit, publish, or run a workflow yourself, and you
should say so plainly if asked to take an action — then explain how the user can do it
themselves in the dashboard (e.g. "open Workflows > [name] and add a Filter step").

Keep answers short and concrete — a few sentences or a short list, not an essay. No preamble.`;

export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Bad request", { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = (await getWorkspaceContext()).workspace.id;
  } catch {
    return new Response("No workspace found for this account.", { status: 400 });
  }

  const { context, evidence } = await buildAccountContext(workspaceId, user.id);
  const gatewayMessages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}` },
    ...messages.slice(-12).map((m) => ({ role: m.role, content: m.content }) satisfies ChatMessage),
  ];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        await runBusinessAIStream(gatewayMessages, (chunk) => controller.enqueue(encoder.encode(chunk)), {
          workspaceId,
          task: "copilot_chat",
          maxTokens: 600,
        });
      } catch (e) {
        console.error("assistant chat error", e);
        controller.enqueue(encoder.encode("\n\n(Sorry — something went wrong reaching the assistant.)"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Real data this answer was grounded in (not a parse of what the model actually
      // cited — the system prompt instructs it to ground claims in exactly this context,
      // so surfacing the context's own entities is the honest version of "citations" for
      // a free-text streaming response). Rendered as clickable chips in ChatWidget.
      "X-Copilot-Evidence": encodeURIComponent(JSON.stringify(evidence.slice(0, 6))),
    },
  });
}
