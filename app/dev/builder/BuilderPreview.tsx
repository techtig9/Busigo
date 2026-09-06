"use client";

import { WorkflowBuilder } from "@/app/(dashboard)/workflows/[id]/WorkflowBuilder";

// Representative graph: a form trigger, an AI qualification step that branches, and two
// follow-on actions. Nothing here touches a database — the server actions the builder calls
// will fail without a session, which is expected in the harness.
const DEFINITION = {
  nodes: [
    { key: "qualify", position: { x: 260, y: 40 }, type: "ai_action" as const, config: { mode: "classify", instruction: "Is this lead qualified?", input: "{{trigger.body}}" } },
    { key: "check", position: { x: 260, y: 180 }, type: "filter" as const, config: { field: "qualify.result", operator: "equals", value: "qualified" } },
    { key: "notify", position: { x: 120, y: 340 }, type: "send_email" as const, config: { to: "sales@example.com", subject: "New qualified lead", body: "{{trigger.body}}" } },
    { key: "crm", position: { x: 420, y: 340 }, type: "http_request" as const, config: { method: "POST", url: "https://api.example.com/leads" } },
  ],
  // GraphEdge shape is {id, source, target, branch} -- see lib/engine/graph.ts.
  edges: [
    { id: "e1", source: "qualify", target: "check" },
    { id: "e2", source: "check", target: "notify", branch: "true" as const },
    { id: "e3", source: "check", target: "crm", branch: "false" as const },
  ],
};

export function BuilderPreview() {
  return (
    <WorkflowBuilder
      workflow={{
        id: "wf_preview",
        name: "Lead qualification",
        description: "Qualify inbound form submissions and route them.",
        trigger_type: "form",
        trigger_token: "preview-token",
        trigger_config: {},
        definition: DEFINITION as any,
        status: "draft",
      }}
      versions={[
        { id: "v3", created_at: new Date(Date.now() - 3600_000).toISOString(), definition: [] },
        { id: "v2", created_at: new Date(Date.now() - 86_400_000).toISOString(), definition: [] },
      ]}
      form={{ slug: "lead-intake", fields: [] }}
      aiActionAllowed
    />
  );
}
